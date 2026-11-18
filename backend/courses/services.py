import logging
from typing import Optional, Tuple
from django.db import transaction
from django.db.models import F, Case, When, Value
from .models import Section, Registration, CartItem, EligibilitySnapshot
from accounts.models import Student
from .eligibility import (
    validate_registration_window,
    validate_prerequisites,
    detect_schedule_clash,
    RegistrationWindowForbiddenError,
    PrerequisiteNotMetError,
    TimetableClashError,
    get_or_compute_eligibility_snapshot,
)

logger = logging.getLogger(__name__)


class RegistrationError(Exception):
    """Base exception for course registration errors."""
    pass


class SectionNotFoundError(RegistrationError):
    """Raised when the specified section cannot be found."""
    pass


class SectionFullError(RegistrationError):
    """Raised when a section has reached maximum capacity."""
    pass


class RegistrationClosedError(RegistrationError):
    """Raised when a section is closed or cancelled for registration."""
    pass


class CourseConflictError(RegistrationError):
    """Raised when a student is already registered for another section of the same course."""
    pass


class CreditLimitExceededError(RegistrationError):
    """Raised when registering exceeds the student's maximum allowed credits."""
    pass


def claim_seat_and_register(
    student: Student,
    section_id: int,
    idempotency_key: Optional[str] = None
) -> Tuple[Registration, bool]:
    """
    Atomically claims a seat in a section with full eligibility gating:
    1. Idempotency Check (returns existing registration if repeated)
    2. Registration Window Check (raises RegistrationWindowForbiddenError -> 403 Forbidden)
    3. Prerequisite Check (raises PrerequisiteNotMetError)
    4. Timetable Clash Detection (raises TimetableClashError)
    5. Course Conflict & Credit Limits
    6. Concurrency-safe atomic conditional update using F('capacity')
    """
    with transaction.atomic():
        # 1. Idempotency check via idempotency_key
        if idempotency_key:
            existing_by_key = (
                Registration.objects.select_for_update()
                .filter(student=student, idempotency_key=idempotency_key, status=Registration.Status.REGISTERED)
                .select_related('section', 'section__course')
                .first()
            )
            if existing_by_key:
                logger.info("Idempotent hit via key '%s' for student %s and section %s",
                            idempotency_key, student.student_id, existing_by_key.section_id)
                return existing_by_key, False

        # 2. Check if student is already actively registered for this section
        existing_reg = (
            Registration.objects.select_for_update()
            .filter(student=student, section_id=section_id, status=Registration.Status.REGISTERED)
            .select_related('section', 'section__course')
            .first()
        )
        if existing_reg:
            logger.info("Student %s already actively registered for section %s",
                        student.student_id, section_id)
            return existing_reg, False

        # 3. Retrieve and validate target section
        section = (
            Section.objects.select_related('course')
            .prefetch_related('schedules')
            .filter(id=section_id)
            .first()
        )
        if not section:
            raise SectionNotFoundError(f"Section with id {section_id} does not exist.")

        # 4. GATE: Registration Window (403 Forbidden if closed/upcoming)
        window_ok, window_reason = validate_registration_window(student, term=section.term)
        if not window_ok:
            raise RegistrationWindowForbiddenError(window_reason)

        # 5. GATE: Prerequisites Check
        prereq_ok, missing_prereqs = validate_prerequisites(student, section.course)
        if not prereq_ok:
            raise PrerequisiteNotMetError("; ".join(missing_prereqs))

        # 6. GATE: Timetable Clash Detection
        has_clash, clash_details = detect_schedule_clash(student, section)
        if has_clash:
            raise TimetableClashError("; ".join(clash_details))

        # 7. Check section open status
        if section.status != Section.Status.OPEN:
            if section.enrolled_count >= section.capacity:
                raise SectionFullError(
                    f"Section {section.course.code}-{section.section_number} is full ({section.capacity}/{section.capacity} seats taken)."
                )
            raise RegistrationClosedError(
                f"Section {section.section_number} is currently {section.status.lower()} for enrollment."
            )

        # 8. Check for course conflicts (same course in the same term)
        conflict_exists = Registration.objects.filter(
            student=student,
            section__course=section.course,
            section__term=section.term,
            status=Registration.Status.REGISTERED
        ).exists()
        if conflict_exists:
            raise CourseConflictError(
                f"You are already registered for a section of {section.course.code} ({section.course.title}) in {section.term}."
            )

        # 9. Check credit limit
        new_total_credits = student.total_enrolled_credits + section.course.credits
        if new_total_credits > student.max_credits:
            raise CreditLimitExceededError(
                f"Registering for {section.course.code} ({section.course.credits} credits) "
                f"would exceed your limit of {student.max_credits} credits. Current: {student.total_enrolled_credits}."
            )

        # 10. ATOMIC CONDITIONAL SEAT CLAIM using F() expression
        rows_updated = Section.objects.filter(
            id=section_id,
            enrolled_count__lt=F('capacity'),
            status=Section.Status.OPEN
        ).update(enrolled_count=F('enrolled_count') + 1)

        if rows_updated == 0:
            section.refresh_from_db()
            if section.enrolled_count >= section.capacity:
                raise SectionFullError(
                    f"Section {section.course.code}-{section.section_number} is full ({section.capacity}/{section.capacity} seats taken)."
                )
            raise RegistrationClosedError(
                f"Section {section.course.code}-{section.section_number} is no longer open for registration."
            )

        # 11. Create or reactivate Registration record
        reg = Registration.objects.filter(student=student, section=section).first()
        if reg:
            reg.status = Registration.Status.REGISTERED
            if idempotency_key:
                reg.idempotency_key = idempotency_key
            reg.save(update_fields=['status', 'idempotency_key', 'updated_at'])
        else:
            reg = Registration.objects.create(
                student=student,
                section=section,
                status=Registration.Status.REGISTERED,
                idempotency_key=idempotency_key
            )

        # Remove from cart if present
        CartItem.objects.filter(student=student, section=section).delete()

        # 12. Check if section capacity is now reached and mark as CLOSED
        section.refresh_from_db()
        if section.enrolled_count >= section.capacity and section.status == Section.Status.OPEN:
            Section.objects.filter(id=section.id, enrolled_count__gte=F('capacity')).update(status=Section.Status.CLOSED)

        # 13. Refresh Eligibility Snapshot
        get_or_compute_eligibility_snapshot(student, section.course, term=section.term, save_snapshot=True)

        logger.info("Successfully claimed seat in section %s for student %s (Registration ID: %s)",
                    section_id, student.student_id, reg.id)
        return reg, True


def drop_registration(student: Student, registration_id: int) -> Registration:
    """
    Atomically drops a student's active registration, decrements the section seat count,
    and updates eligibility snapshots.
    """
    with transaction.atomic():
        registration = (
            Registration.objects.select_for_update()
            .filter(id=registration_id, student=student, status=Registration.Status.REGISTERED)
            .select_related('section', 'section__course')
            .first()
        )
        if not registration:
            raise RegistrationError("No active registration found to drop.")

        registration.status = Registration.Status.DROPPED
        registration.save(update_fields=['status', 'updated_at'])

        # Decrement seat count atomically (preventing below 0)
        Section.objects.filter(
            id=registration.section_id,
            enrolled_count__gt=0
        ).update(enrolled_count=F('enrolled_count') - 1)

        # Reopen if it was previously closed due to full capacity
        section = registration.section
        section.refresh_from_db()
        if section.status == Section.Status.CLOSED and section.enrolled_count < section.capacity:
            Section.objects.filter(id=section.id).update(status=Section.Status.OPEN)

        # Update Eligibility Snapshot
        get_or_compute_eligibility_snapshot(student, section.course, term=section.term, save_snapshot=True)

        logger.info("Dropped registration %s for student %s; freed 1 seat in section %s",
                    registration_id, student.student_id, registration.section_id)
        return registration


def add_section_to_cart(student: Student, section_id: int) -> CartItem:
    """
    Adds a section to the student's cart after validating prerequisites and schedule clashes.
    """
    section = Section.objects.select_related('course').filter(id=section_id).first()
    if not section:
        raise SectionNotFoundError(f"Section with id {section_id} does not exist.")

    # 1. Prerequisite check
    prereq_ok, missing_prereqs = validate_prerequisites(student, section.course)
    if not prereq_ok:
        raise PrerequisiteNotMetError("; ".join(missing_prereqs))

    # 2. Timetable clash check (against registered sections AND current cart items)
    has_clash, clash_details = detect_schedule_clash(student, section, include_cart=True)
    if has_clash:
        raise TimetableClashError("; ".join(clash_details))

    cart_item, created = CartItem.objects.get_or_create(student=student, section=section)
    return cart_item
