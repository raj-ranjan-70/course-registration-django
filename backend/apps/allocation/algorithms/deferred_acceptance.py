"""
Student-Proposing Deferred Acceptance (Gale-Shapley) Algorithm.

This module is completely decoupled from Django models and operates exclusively
on raw Python data structures (lists, dictionaries, strings, numbers).

Properties of Student-Proposing Deferred Acceptance:
1. Stability: The final matching has no blocking student-course pair (no justified envy).
2. Student-Optimality: Produces the Pareto-best stable matching for all students.
3. Strategy-Proofness: Truth-telling is a weakly dominant strategy for students.
"""

from typing import Dict, List, Optional, Tuple, Any, Union


def deferred_acceptance(
    students: List[Union[str, int]],
    capacities: Dict[Union[str, int], int],
    student_preferences: Dict[Union[str, int], List[Union[str, int]]],
    course_priorities: Dict[Union[str, int], Dict[Union[str, int], float]],
) -> Dict[str, Any]:
    """
    Executes the student-proposing Deferred Acceptance algorithm.

    Args:
        students:
            List of student identifiers, e.g. ['STU-001', 'STU-002'].
        capacities:
            Dictionary mapping course identifier -> maximum student quota, e.g. {'CS350': 2}.
        student_preferences:
            Dictionary mapping student identifier -> ordered list of preferred course identifiers.
            Index 0 represents the 1st choice, index 1 represents the 2nd choice, etc.
        course_priorities:
            Dictionary mapping course identifier -> dictionary of {student_identifier: priority_score}.
            Higher priority_score means the course ranks the student higher.

    Returns:
        A dictionary containing:
            - matches: Dict[course_id, List[student_id]]
            - student_matches: Dict[student_id, course_id | None]
            - student_ranks: Dict[student_id, int | None] (1-based rank, None if unmatched)
            - rejections: Dict[student_id, List[course_id]]
            - rank_distribution: Dict[str, int] (e.g. {'1': 12, '2': 4, 'unmatched': 2})
            - total_students: int
            - total_matched: int
            - total_unmatched: int
            - satisfaction_rate: float (percentage of students receiving their 1st or 2nd choice)
            - rounds: int
    """
    # Initialize provisional matches for each course with a positive capacity
    provisional_matches: Dict[Union[str, int], List[Union[str, int]]] = {
        c: [] for c in capacities
    }

    # Tracking student state
    # Next choice index each student will propose to
    proposal_index: Dict[Union[str, int], int] = {s: 0 for s in students}

    # Track rejections for each student
    rejection_history: Dict[Union[str, int], List[Union[str, int]]] = {
        s: [] for s in students
    }

    # Queue of currently free/unmatched students who still have preferences left
    free_students: List[Union[str, int]] = [
        s for s in students if len(student_preferences.get(s, [])) > 0
    ]

    rounds = 0

    while free_students:
        rounds += 1
        student = free_students.pop(0)
        prefs = student_preferences.get(student, [])
        idx = proposal_index[student]

        # If student has exhausted all preferences, they remain unmatched
        if idx >= len(prefs):
            continue

        target_course = prefs[idx]
        proposal_index[student] += 1

        # Check if course exists in capacities and has capacity > 0
        quota = capacities.get(target_course, 0)
        if quota <= 0:
            rejection_history[student].append(target_course)
            if proposal_index[student] < len(prefs):
                free_students.append(student)
            continue

        # Add student to candidate pool for target_course
        current_candidates = provisional_matches.get(target_course, []) + [student]

        # Prioritize candidates based on course_priorities for target_course
        priorities_for_course = course_priorities.get(target_course, {})

        # Sort descending by priority score; secondary tiebreak on string representation of student_id
        sorted_candidates = sorted(
            current_candidates,
            key=lambda s: (priorities_for_course.get(s, 0.0), str(s)),
            reverse=True
        )

        # Retain top `quota` candidates, reject the rest
        accepted = sorted_candidates[:quota]
        rejected = sorted_candidates[quota:]

        provisional_matches[target_course] = accepted

        # Handle rejected students: they re-enter the free queue if they have remaining preferences
        for rej in rejected:
            rejection_history[rej].append(target_course)
            if proposal_index[rej] < len(student_preferences.get(rej, [])):
                free_students.append(rej)

    # Invert mapping: student -> assigned course
    student_matches: Dict[Union[str, int], Optional[Union[str, int]]] = {
        s: None for s in students
    }
    for course_id, admitted_students in provisional_matches.items():
        for s in admitted_students:
            student_matches[s] = course_id

    # Compute ranks achieved
    student_ranks: Dict[Union[str, int], Optional[int]] = {
        s: None for s in students
    }
    rank_distribution: Dict[str, int] = {}
    matched_count = 0
    top_2_count = 0

    for s, matched_course in student_matches.items():
        if matched_course is not None:
            matched_count += 1
            prefs = student_preferences.get(s, [])
            try:
                rank = prefs.index(matched_course) + 1  # 1-based index
                student_ranks[s] = rank
                rank_key = str(rank)
                rank_distribution[rank_key] = rank_distribution.get(rank_key, 0) + 1
                if rank <= 2:
                    top_2_count += 1
            except ValueError:
                student_ranks[s] = None
        else:
            rank_distribution['unmatched'] = rank_distribution.get('unmatched', 0) + 1

    total_students_count = len(students)
    unmatched_count = total_students_count - matched_count
    satisfaction_rate = (
        round((top_2_count / total_students_count) * 100, 2)
        if total_students_count > 0
        else 0.0
    )

    return {
        'matches': provisional_matches,
        'student_matches': student_matches,
        'student_ranks': student_ranks,
        'rejections': rejection_history,
        'rank_distribution': rank_distribution,
        'total_students': total_students_count,
        'total_matched': matched_count,
        'total_unmatched': unmatched_count,
        'satisfaction_rate': satisfaction_rate,
        'rounds': rounds,
    }
