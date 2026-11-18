"""
Reproducible Priority & Tiebreaker Policy Engine.

Implements deterministic student-course priority ordering based on:
1. Cohort Priority (Seniors > Juniors > Sophomores > Freshmen)
2. Programme / Major Alignment (Major core/elective bonus)
3. Academic Performance (CGPA band weighting)
4. SHA-256 Seeded Tiebreaker:
   calculate_tiebreak(seed, student_id, course_id)
   Guarantees 100% reproducible historical allocation runs.
"""

import hashlib
from typing import Dict, Tuple, Any, Union


def calculate_tiebreak(seed: str, student_id: Union[str, int], course_id: Union[str, int]) -> float:
    """
    Computes a deterministic, reproducible float in [0.0, 1.0) using SHA-256.

    Args:
        seed: Arbitrary string seed provided for the allocation run (e.g. '2026-fall-run-01').
        student_id: Identifier of the student.
        course_id: Identifier of the course.

    Returns:
        A deterministic float between 0.0 and 1.0.
    """
    payload = f"{seed}:{student_id}:{course_id}".encode('utf-8')
    digest = hashlib.sha256(payload).hexdigest()
    # Take first 12 hex characters (48 bits of entropy)
    integer_val = int(digest[:12], 16)
    max_val = 16 ** 12
    return integer_val / max_val


def compute_priority_score(
    cohort_name: str,
    academic_year: str,
    student_major: str,
    course_department: str,
    cgpa: float,
    seed: str,
    student_id: Union[str, int],
    course_id: Union[str, int],
    weights: Dict[str, float] = None,
    target_branches: list = None,
) -> Tuple[float, Dict[str, Any]]:
    """
    Computes the composite priority score for a student at a given course.

    Priority hierarchy:
    1. Cohort / Academic Year (base weight 100 - 400)
    2. Programme / Department / Branch alignment bonus (0 or 50)
    3. CGPA Band (0.0 to 40.0)
    4. Deterministic SHA-256 tiebreaker in [0, 1)

    Returns:
        (total_score, breakdown_details)
    """
    cfg = weights or {
        'senior': 400.0,
        'junior': 300.0,
        'sophomore': 200.0,
        'freshman': 100.0,
        'major_bonus': 50.0,
        'cgpa_multiplier': 10.0,
    }

    # 1. Cohort base score
    year_lower = (academic_year or cohort_name or '').lower()
    if 'senior' in year_lower:
        cohort_score = cfg.get('senior', 400.0)
    elif 'junior' in year_lower:
        cohort_score = cfg.get('junior', 300.0)
    elif 'sophomore' in year_lower:
        cohort_score = cfg.get('sophomore', 200.0)
    else:
        cohort_score = cfg.get('freshman', 100.0)

    # 2. Programme / Major / Branch Alignment bonus
    major_lower = (student_major or '').strip().lower()
    dept_lower = (course_department or '').strip().lower()
    is_major_match = bool(major_lower and dept_lower and (major_lower in dept_lower or dept_lower in major_lower))
    
    if not is_major_match and target_branches:
        for tb in target_branches:
            tb_lower = str(tb).strip().lower()
            if tb_lower and (tb_lower in major_lower or major_lower in tb_lower):
                is_major_match = True
                break

    programme_bonus = cfg.get('major_bonus', 50.0) if is_major_match else 0.0

    # 3. CGPA Band
    cgpa_val = float(cgpa or 3.0)
    cgpa_score = cgpa_val * cfg.get('cgpa_multiplier', 10.0)

    # 4. SHA-256 Seeded Tiebreaker (strictly in [0.0, 0.999999))
    tiebreak_raw = calculate_tiebreak(seed, student_id, course_id)
    tiebreak_score = tiebreak_raw * 0.999999

    total_score = cohort_score + programme_bonus + cgpa_score + tiebreak_score

    breakdown = {
        'cohort_score': cohort_score,
        'programme_bonus': programme_bonus,
        'is_major_match': is_major_match,
        'cgpa_score': round(cgpa_score, 2),
        'cgpa': cgpa_val,
        'tiebreaker_raw': round(tiebreak_raw, 6),
        'tiebreaker_score': round(tiebreak_score, 6),
        'total_score': round(total_score, 6),
    }

    return total_score, breakdown
