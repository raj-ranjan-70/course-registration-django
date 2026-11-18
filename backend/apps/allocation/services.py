import time
import logging
from typing import Dict, List, Optional
from django.db import transaction
from django.utils import timezone
from accounts.models import Student
from courses.models import Course, Section
from courses.services import claim_seat_and_register
from .models import ElectivePreference, AllocationRun, AllocationResult
from .algorithms.deferred_acceptance import deferred_acceptance
from .algorithms.priority import compute_priority_score, calculate_tiebreak

logger = logging.getLogger(__name__)


def execute_allocation_run(
    term: str = 'Fall 2026',
    seed: Optional[str] = None,
    apply_enrollment: bool = False,
    weights: Optional[Dict[str, float]] = None,
) -> AllocationRun:
    """
    Executes a complete batch elective allocation run using the student-proposing
    Deferred Acceptance (Gale-Shapley) algorithm and reproducible SHA-256 tiebreaking.

    Workflow:
    1. Collect student elective preferences for the term.
    2. Determine course capacities based on section quotas.
    3. Calculate deterministic priority scores for each student-course pair using:
       Cohort + Major Match + CGPA + SHA-256 Seeded Tiebreaker.
    4. Execute Gale-Shapley deferred acceptance algorithm on raw Python data structures.
    5. Persist audit snapshots into AllocationRun and AllocationResult models.
    6. Optionally auto-enroll matched students into active sections.
    """
    start_time = time.perf_counter()
    run_seed = seed.strip() if (seed and seed.strip()) else f"seed-{int(time.time())}"

    with transaction.atomic():
        # Create initial run record
        run = AllocationRun.objects.create(
            term=term,
            seed=run_seed,
            status=AllocationRun.Status.RUNNING,
            algorithm='Deferred Acceptance (Gale-Shapley)',
            config={'weights': weights or {}, 'apply_enrollment': apply_enrollment},
        )

        # 1. Fetch preferences for this term
        preferences = (
            ElectivePreference.objects.filter(term=term)
            .select_related('student', 'student__user', 'student__cohort', 'course')
            .order_by('student__student_id', 'preference_rank')
        )

        student_ids_set = set()
        course_ids_set = set()
        student_preferences: Dict[str, List[int]] = {}
        students_map: Dict[str, Student] = {}
        courses_map: Dict[int, Course] = {}

        for p in preferences:
            s_id = p.student.student_id
            c_id = p.course_id
            student_ids_set.add(s_id)
            course_ids_set.add(c_id)
            students_map[s_id] = p.student
            courses_map[c_id] = p.course

            if s_id not in student_preferences:
                student_preferences[s_id] = []
            student_preferences[s_id].append(c_id)

        students_list = sorted(list(student_ids_set))

        # 2. Determine course capacities (sum of capacities of open sections in the term)
        capacities: Dict[int, int] = {}
        for c_id in course_ids_set:
            course = courses_map[c_id]
            sections = course.sections.filter(term=term, status=Section.Status.OPEN)
            # Take available seats or total capacity
            avail_sum = sum(s.capacity for s in sections)
            # Default to at least 1 or 2 if no sections created
            capacities[c_id] = max(1, avail_sum) if avail_sum > 0 else 2

        # 3. Compute priority scores for each course and student
        course_priorities: Dict[int, Dict[str, float]] = {}
        priority_breakdown_audit: Dict[str, Dict[int, Dict]] = {}

        for c_id in course_ids_set:
            course = courses_map[c_id]
            course_priorities[c_id] = {}

            for s_id in students_list:
                student = students_map[s_id]
                score, breakdown = compute_priority_score(
                    cohort_name=student.cohort.name if student.cohort else '',
                    academic_year=student.academic_year,
                    student_major=(student.branch or student.major or ''),
                    course_department=course.department,
                    cgpa=getattr(student, 'cgpa', 3.5),
                    seed=run_seed,
                    student_id=s_id,
                    course_id=c_id,
                    weights=weights,
                    target_branches=getattr(course, 'target_branches', None),
                )
                course_priorities[c_id][s_id] = score

                if s_id not in priority_breakdown_audit:
                    priority_breakdown_audit[s_id] = {}
                priority_breakdown_audit[s_id][c_id] = breakdown

        # 4. Execute Gale-Shapley Deferred Acceptance
        matching_result = deferred_acceptance(
            students=students_list,
            capacities=capacities,
            student_preferences=student_preferences,
            course_priorities=course_priorities,
        )

        student_matches = matching_result['student_matches']
        student_ranks = matching_result['student_ranks']
        rejections = matching_result['rejections']

        # 5. Persist AllocationResult records
        results_to_create = []
        for s_id in students_list:
            student = students_map[s_id]
            matched_course_id = student_matches.get(s_id)
            matched = matched_course_id is not None
            course_obj = courses_map.get(matched_course_id) if matched else None
            rank_achieved = student_ranks.get(s_id)

            score_val = 0.0
            tiebreak_val = 0.0
            breakdown_val = {}

            if matched_course_id:
                breakdown_val = priority_breakdown_audit.get(s_id, {}).get(matched_course_id, {})
                score_val = breakdown_val.get('total_score', 0.0)
                tiebreak_val = breakdown_val.get('tiebreaker_raw', 0.0)
            elif student_preferences.get(s_id):
                first_pref_id = student_preferences[s_id][0]
                breakdown_val = priority_breakdown_audit.get(s_id, {}).get(first_pref_id, {})
                score_val = breakdown_val.get('total_score', 0.0)
                tiebreak_val = breakdown_val.get('tiebreaker_raw', 0.0)

            # Optional enrollment in a section
            assigned_sec = None
            if matched and apply_enrollment and course_obj:
                sec = course_obj.sections.filter(term=term, status=Section.Status.OPEN).first()
                if sec:
                    try:
                        claim_seat_and_register(student, sec.id, idempotency_key=f"alloc-{run.id}-{s_id}")
                        assigned_sec = sec
                    except Exception as e:
                        logger.warning("Auto-enrollment failed for %s in %s: %s", s_id, sec, e)

            result_entry = AllocationResult(
                allocation_run=run,
                student=student,
                course=course_obj,
                assigned_section=assigned_sec,
                matched=matched,
                preference_rank=rank_achieved,
                priority_score=score_val,
                tiebreaker_value=tiebreak_val,
                audit_details={
                    'breakdown': breakdown_val,
                    'rejections': rejections.get(s_id, []),
                    'preferences': [
                        {'course_id': cid, 'code': courses_map[cid].code, 'title': courses_map[cid].title}
                        for cid in student_preferences.get(s_id, [])
                        if cid in courses_map
                    ],
                },
            )
            results_to_create.append(result_entry)

        AllocationResult.objects.bulk_create(results_to_create)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        # Update run summary
        run.status = AllocationRun.Status.COMPLETED
        run.total_students = matching_result['total_students']
        run.total_courses = len(course_ids_set)
        run.total_matched = matching_result['total_matched']
        run.total_unmatched = matching_result['total_unmatched']
        run.satisfaction_rate = matching_result['satisfaction_rate']
        run.rank_distribution = matching_result['rank_distribution']
        run.execution_time_ms = round(elapsed_ms, 2)
        run.completed_at = timezone.now()
        run.save()

        logger.info(
            "AllocationRun #%s complete: %s/%s matched (%.1f%% satisfaction) in %.2f ms",
            run.id, run.total_matched, run.total_students, run.satisfaction_rate, elapsed_ms
        )
        return run
