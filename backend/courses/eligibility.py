import logging
from typing import Dict, List, Optional, Tuple
from django.utils import timezone
from .models import (
    Course,
    Section,
    Prerequisite,
    StudentCourseHistory,
    ClassSchedule,
    RegistrationWindow,
    Registration,
    CartItem,
    EligibilitySnapshot,
)
from accounts.models import Student

logger = logging.getLogger(__name__)


class EligibilityError(Exception):
    """Base exception for eligibility checks."""
    pass


class RegistrationWindowForbiddenError(EligibilityError):
    """Raised with HTTP 403 when registration is attempted outside an active window."""
    pass


class PrerequisiteNotMetError(EligibilityError):
    """Raised when required prerequisites have not been passed."""
    pass


class TimetableClashError(EligibilityError):
    """Raised when a section has overlapping class schedules with an enrolled section."""
    pass


def validate_registration_window(student: Student, term: str = 'Fall 2026') -> Tuple[bool, Optional[str]]:
    """
    Validates whether the student's cohort has an active registration window.
    Returns:
        (is_open: bool, rejection_reason: Optional[str])
    """
    if not student.cohort:
        # If student has no cohort assigned, allow or return warning
        return True, None

    window = (
        RegistrationWindow.objects.filter(cohort=student.cohort, term=term)
        .order_by('-start_time')
        .first()
    )

    if not window:
        return False, f"No registration window configured for cohort '{student.cohort.name}' in {term}."

    now = timezone.now()
    if window.status == RegistrationWindow.Status.CLOSED or now > window.end_time:
        end_str = window.end_time.strftime('%b %d, %Y at %I:%M %p')
        return False, f"Registration window for {student.cohort.name} is closed (Ended {end_str})."

    if window.status == RegistrationWindow.Status.UPCOMING or now < window.start_time:
        start_str = window.start_time.strftime('%b %d, %Y at %I:%M %p')
        return False, f"Registration window for {student.cohort.name} is not open yet (Opens {start_str})."

    return True, None


def validate_prerequisites(student: Student, course: Course) -> Tuple[bool, List[str]]:
    """
    Validates whether the student has passed all required prerequisites for the given course.
    Returns:
        (satisfied: bool, missing_prerequisites_details: List[str])
    """
    prereqs = Prerequisite.objects.filter(course=course, is_mandatory=True).select_related('prerequisite_course')
    if not prereqs.exists():
        return True, []

    missing = []
    # Fetch all passed course IDs for this student
    passed_course_ids = set(
        StudentCourseHistory.objects.filter(student=student, passed=True).values_list('course_id', flat=True)
    )

    for p in prereqs:
        if p.prerequisite_course_id not in passed_course_ids:
            missing.append(
                f"Missing Prerequisite: {p.prerequisite_course.code} ({p.prerequisite_course.title}) - Requires minimum grade {p.min_grade}"
            )

    return (len(missing) == 0), missing


def detect_schedule_clash(
    student: Student,
    section: Section,
    include_cart: bool = False
) -> Tuple[bool, List[str]]:
    """
    Detects time-interval overlaps between candidate section schedules and:
    1. Active registered sections in the same term.
    2. In-cart sections (if include_cart=True).
    Interval overlap formula: day == other.day and start_time < other.end_time and other.start_time < end_time
    """
    candidate_schedules = list(section.schedules.all())
    if not candidate_schedules:
        return False, []

    clashes = []

    # 1. Compare against registered sections in the same term
    registered_sections = Section.objects.filter(
        registrations__student=student,
        registrations__status=Registration.Status.REGISTERED,
        term=section.term
    ).exclude(id=section.id).prefetch_related('schedules', 'course')

    for reg_sec in registered_sections:
        for reg_sched in reg_sec.schedules.all():
            for cand_sched in candidate_schedules:
                if cand_sched.clashes_with(reg_sched):
                    clashes.append(
                        f"Timetable Clash: {section.course.code}-{section.section_number} "
                        f"({cand_sched.day} {cand_sched.start_time.strftime('%H:%M')}-{cand_sched.end_time.strftime('%H:%M')}) "
                        f"overlaps with enrolled {reg_sec.course.code}-{reg_sec.section_number} "
                        f"({reg_sched.day} {reg_sched.start_time.strftime('%H:%M')}-{reg_sched.end_time.strftime('%H:%M')})"
                    )

    # 2. Compare against in-cart items if requested
    if include_cart:
        cart_sections = Section.objects.filter(
            in_carts__student=student,
            term=section.term
        ).exclude(id=section.id).prefetch_related('schedules', 'course')

        for cart_sec in cart_sections:
            for cart_sched in cart_sec.schedules.all():
                for cand_sched in candidate_schedules:
                    if cand_sched.clashes_with(cart_sched):
                        clashes.append(
                            f"Cart Clash: {section.course.code}-{section.section_number} "
                            f"overlaps with item in cart {cart_sec.course.code}-{cart_sec.section_number} "
                            f"({cart_sched.day} {cart_sched.start_time.strftime('%H:%M')}-{cart_sched.end_time.strftime('%H:%M')})"
                        )

    return (len(clashes) > 0), clashes


def evaluate_course_eligibility(
    student: Student,
    course: Course,
    term: str = 'Fall 2026',
    include_cart_in_clashes: bool = False
) -> Dict:
    """
    Comprehensive evaluation of a student's eligibility for a course and its individual sections
    based on active faculty configuration rules and academic prerequisites.
    """
    course_reasons = []

    # 1. Submission Deadline Check
    now = timezone.now()
    deadline_ok = True
    if course.submission_deadline and now > course.submission_deadline:
        deadline_str = course.submission_deadline.strftime('%b %d, %Y at %I:%M %p')
        course_reasons.append(f"Deadline Elapsed: Elective registration deadline closed on {deadline_str}.")
        deadline_ok = False

    # 2. Target Degrees Check (Optional/Unrestricted if empty)
    degree_ok = True
    if course.target_degrees and len(course.target_degrees) > 0:
        student_deg = (student.degree or '').strip().lower()
        allowed_degs = [d.strip().lower() for d in course.target_degrees]
        if student_deg not in allowed_degs and not any(d in student_deg for d in allowed_degs):
            deg_list = ", ".join(course.target_degrees)
            course_reasons.append(f"Degree Restricted: Course is restricted to [{deg_list}] (Your degree: {student.degree}).")
            degree_ok = False

    # 3. Target Branches / Category Check (Optional/Unrestricted if empty)
    branch_ok = True
    student_branch = (student.branch or student.major or '').strip().lower()

    if course.target_branches and len(course.target_branches) > 0:
        allowed_branches = [b.strip().lower() for b in course.target_branches]
        matched_branch = any(
            b in student_branch or student_branch in b
            for b in allowed_branches
        )
        if not matched_branch:
            branch_list = ", ".join(course.target_branches)
            course_reasons.append(f"Branch Restricted: Course is restricted to [{branch_list}] (Your branch: {student.branch or student.major}).")
            branch_ok = False
    elif course.category == Course.Category.DEPARTMENT:
        # Department elective without explicit branches requires student's department/branch to match course department
        dept_lower = (course.department or '').strip().lower()
        if dept_lower and not (dept_lower in student_branch or student_branch in dept_lower):
            course_reasons.append(f"Department Elective: Reserved for {course.department} students (Your branch: {student.branch or student.major}).")
            branch_ok = False

    # 4. Semester Restriction Check (Optional/Unrestricted if empty)
    semester_ok = True
    if course.allowed_semesters and len(course.allowed_semesters) > 0:
        if student.semester not in course.allowed_semesters:
            sem_list = ", ".join(map(str, course.allowed_semesters))
            course_reasons.append(f"Semester Restricted: Open only to Semester(s) {sem_list} (Your semester: {student.semester}).")
            semester_ok = False

    # 5. Minimum CGPA Check (Optional/Unrestricted if None)
    cgpa_ok = True
    if course.min_cgpa is not None:
        if student.cgpa < course.min_cgpa:
            course_reasons.append(f"CGPA Requirement: Minimum CGPA of {course.min_cgpa:.2f} required (Your CGPA: {student.cgpa:.2f}).")
            cgpa_ok = False

    # 6. Registration Window Check
    window_ok, window_reason = validate_registration_window(student, term=term)
    if not window_ok and window_reason:
        course_reasons.append(window_reason)

    # 7. Prerequisites Check
    prereqs_ok, prereq_reasons = validate_prerequisites(student, course)
    course_reasons.extend(prereq_reasons)

    # 8. Already Completed Check
    already_passed = StudentCourseHistory.objects.filter(
        student=student,
        course=course,
        passed=True
    ).exists()
    if already_passed:
        course_reasons.append(f"Course already passed: You have already completed {course.code}.")

    # 9. Already Registered in Term Check
    already_registered = Registration.objects.filter(
        student=student,
        section__course=course,
        section__term=term,
        status=Registration.Status.REGISTERED
    ).exists()
    if already_registered:
        course_reasons.append(f"Already enrolled: You are registered for a section of {course.code} in {term}.")

    faculty_rules_ok = (deadline_ok and degree_ok and branch_ok and semester_ok and cgpa_ok)

    # 10. Section-level evaluation
    sections = course.sections.filter(term=term).prefetch_related('schedules')
    section_breakdown = {}
    any_section_eligible = False

    for sec in sections:
        sec_reasons = list(course_reasons)  # inherits course-level reasons
        sec_eligible = True

        # Check section capacity
        if sec.is_full or sec.available_seats <= 0:
            sec_reasons.append(f"Section {sec.section_number} is full ({sec.capacity}/{sec.capacity} seats taken).")
            sec_eligible = False

        # Check section status
        if sec.status != Section.Status.OPEN:
            sec_reasons.append(f"Section {sec.section_number} is closed for registration (Status: {sec.status}).")
            sec_eligible = False

        # Check timetable clash
        has_clash, clash_details = detect_schedule_clash(
            student=student,
            section=sec,
            include_cart=include_cart_in_clashes
        )
        if has_clash:
            sec_reasons.extend(clash_details)
            sec_eligible = False

        if not window_ok or not prereqs_ok or already_passed or already_registered or not faculty_rules_ok:
            sec_eligible = False

        if sec_eligible:
            any_section_eligible = True

        section_breakdown[sec.id] = {
            'section_id': sec.id,
            'section_number': sec.section_number,
            'eligible': sec_eligible,
            'reasons': sec_reasons,
            'has_clash': has_clash,
            'is_full': sec.is_full,
        }

    overall_eligible = (
        faculty_rules_ok and window_ok and prereqs_ok and not already_passed and not already_registered and any_section_eligible
    )

    return {
        'course_id': course.id,
        'course_code': course.code,
        'eligible': overall_eligible,
        'reasons': course_reasons,
        'window_status': {
            'open': window_ok,
            'reason': window_reason,
        },
        'prerequisites_status': {
            'satisfied': prereqs_ok,
            'missing': prereq_reasons,
        },
        'rules_status': {
            'deadline_ok': deadline_ok,
            'degree_ok': degree_ok,
            'branch_ok': branch_ok,
            'semester_ok': semester_ok,
            'cgpa_ok': cgpa_ok,
        },
        'section_eligibility': section_breakdown,
    }


def get_or_compute_eligibility_snapshot(
    student: Student,
    course: Course,
    term: str = 'Fall 2026',
    save_snapshot: bool = True
) -> EligibilitySnapshot:
    """
    Evaluates eligibility and saves/updates the EligibilitySnapshot model record.
    """
    evaluation = evaluate_course_eligibility(student, course, term=term)

    if save_snapshot:
        snapshot, _ = EligibilitySnapshot.objects.update_or_create(
            student=student,
            course=course,
            defaults={
                'eligible': evaluation['eligible'],
                'reasons': evaluation['reasons'],
                'section_eligibility': evaluation['section_eligibility'],
            }
        )
        return snapshot

    # If save_snapshot is False, return unsaved instance
    return EligibilitySnapshot(
        student=student,
        course=course,
        eligible=evaluation['eligible'],
        reasons=evaluation['reasons'],
        section_eligibility=evaluation['section_eligibility']
    )


def precompute_all_snapshots_for_student(student: Student, term: str = 'Fall 2026') -> Dict[int, Dict]:
    """
    Precomputes snapshots for all active courses for the student, returning a dict keyed by course_id.
    """
    courses = Course.objects.filter(is_active=True).prefetch_related('prerequisites__prerequisite_course', 'sections__schedules')
    results = {}
    for course in courses:
        evaluation = evaluate_course_eligibility(student, course, term=term)
        EligibilitySnapshot.objects.update_or_create(
            student=student,
            course=course,
            defaults={
                'eligible': evaluation['eligible'],
                'reasons': evaluation['reasons'],
                'section_eligibility': evaluation['section_eligibility'],
            }
        )
        results[course.id] = evaluation
    return results
