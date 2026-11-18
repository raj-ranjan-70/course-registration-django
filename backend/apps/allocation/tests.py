from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from accounts.models import User, Student, Cohort
from courses.models import Course, Section
from apps.allocation.models import ElectivePreference, AllocationRun, AllocationResult
from apps.allocation.algorithms.deferred_acceptance import deferred_acceptance
from apps.allocation.algorithms.priority import calculate_tiebreak, compute_priority_score
from apps.allocation.services import execute_allocation_run


class DeferredAcceptanceAlgorithmTests(TestCase):
    def test_gale_shapley_matching_stability(self):
        """
        Verify Gale-Shapley matching stability with simple 3-student, 2-course scenario.
        """
        students = ['S1', 'S2', 'S3']
        capacities = {'C1': 1, 'C2': 1}
        # S1 prefers C1, then C2
        # S2 prefers C1, then C2
        # S3 prefers C2, then C1
        preferences = {
            'S1': ['C1', 'C2'],
            'S2': ['C1', 'C2'],
            'S3': ['C2', 'C1'],
        }
        # Course priorities:
        # C1 prefers S1 over S2 over S3
        # C2 prefers S2 over S3 over S1
        priorities = {
            'C1': {'S1': 100.0, 'S2': 50.0, 'S3': 10.0},
            'C2': {'S1': 10.0, 'S2': 100.0, 'S3': 50.0},
        }

        result = deferred_acceptance(students, capacities, preferences, priorities)

        # C1 has capacity 1: S1 proposes to C1 and C1 accepts S1 (score 100 > S2 score 50)
        # S2 proposes to C1, gets rejected, then proposes to C2
        # S3 proposes to C2; but C2 prefers S2 (score 100 > S3 score 50), so C2 holds S2 and rejects S3
        # Final matching: S1 -> C1, S2 -> C2, S3 -> None
        self.assertEqual(result['student_matches']['S1'], 'C1')
        self.assertEqual(result['student_matches']['S2'], 'C2')
        self.assertIsNone(result['student_matches']['S3'])
        self.assertEqual(result['total_matched'], 2)
        self.assertEqual(result['total_unmatched'], 1)

    def test_capacity_strictly_respected(self):
        """No course should ever be assigned more students than its quota."""
        students = [f'S{i}' for i in range(10)]
        capacities = {'POPULAR_COURSE': 3}
        preferences = {s: ['POPULAR_COURSE'] for s in students}
        priorities = {'POPULAR_COURSE': {f'S{i}': float(i) for i in range(10)}}

        res = deferred_acceptance(students, capacities, preferences, priorities)

        self.assertEqual(len(res['matches']['POPULAR_COURSE']), 3)
        # Students with highest scores (S9, S8, S7) should win
        self.assertEqual(set(res['matches']['POPULAR_COURSE']), {'S9', 'S8', 'S7'})


class ReproducibleTiebreakerTests(TestCase):
    def test_sha256_tiebreaker_is_deterministic(self):
        """calculate_tiebreak with the same seed, student_id, and course_id returns identical float."""
        val1 = calculate_tiebreak('audit-seed-2026', 'STU-001', 101)
        val2 = calculate_tiebreak('audit-seed-2026', 'STU-001', 101)
        self.assertEqual(val1, val2)
        self.assertTrue(0.0 <= val1 < 1.0)

        # Different seed produces different value
        val_diff_seed = calculate_tiebreak('other-seed', 'STU-001', 101)
        self.assertNotEqual(val1, val_diff_seed)

    def test_priority_score_hierarchy(self):
        """Senior with same CGPA ranks higher than Junior, and major bonus gives extra boost."""
        score_senior, _ = compute_priority_score(
            cohort_name='Senior Cohort',
            academic_year='Senior',
            student_major='Computer Science',
            course_department='Computer Science',
            cgpa=3.8,
            seed='seed1',
            student_id='STU-SR',
            course_id=1,
        )
        score_junior, _ = compute_priority_score(
            cohort_name='Junior Cohort',
            academic_year='Junior',
            student_major='Computer Science',
            course_department='Computer Science',
            cgpa=3.8,
            seed='seed1',
            student_id='STU-JR',
            course_id=1,
        )
        # Senior base 400 + 50 + 38 > Junior base 300 + 50 + 38
        self.assertGreater(score_senior, score_junior)


class ElectivePreferenceAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='pref_student', email='pref@test.edu', password='p', role=User.Role.STUDENT)
        self.student = Student.objects.create(user=self.user, student_id='STU-PREF-01', major='CS', cgpa=3.7)
        self.client.force_authenticate(user=self.user)

        self.c1 = Course.objects.create(code='ELEC101', title='Elective 1', credits=3, department='CS')
        self.c2 = Course.objects.create(code='ELEC102', title='Elective 2', credits=3, department='CS')
        self.c3 = Course.objects.create(code='ELEC103', title='Elective 3', credits=3, department='CS')

    def test_submit_bulk_preferences(self):
        """POST /api/preferences/ saves ranked order of course choices."""
        payload = {
            'student_id': self.student.student_id,
            'term': 'Fall 2026',
            'course_ids': [self.c2.id, self.c1.id, self.c3.id],
        }
        resp = self.client.post('/api/preferences/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        prefs = ElectivePreference.objects.filter(student=self.student, term='Fall 2026').order_by('preference_rank')
        self.assertEqual(prefs.count(), 3)
        self.assertEqual(prefs[0].course_id, self.c2.id)
        self.assertEqual(prefs[0].preference_rank, 1)
        self.assertEqual(prefs[1].course_id, self.c1.id)
        self.assertEqual(prefs[1].preference_rank, 2)
        self.assertEqual(prefs[2].course_id, self.c3.id)
        self.assertEqual(prefs[2].preference_rank, 3)

    def test_get_preferences_me(self):
        """GET /api/preferences/me/ retrieves ranked preferences for the current student."""
        ElectivePreference.objects.create(student=self.student, course=self.c1, preference_rank=1, term='Fall 2026')
        ElectivePreference.objects.create(student=self.student, course=self.c2, preference_rank=2, term='Fall 2026')

        resp = self.client.get(f'/api/preferences/me/?student_id={self.student.student_id}&term=Fall 2026')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(len(data['preferences']), 2)
        self.assertEqual(data['preferences'][0]['course_code'], 'ELEC101')


class AllocationRunAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Faculty account for running allocation
        self.faculty_user = User.objects.create_user(
            username='fac_admin',
            email='fac_admin@univ.edu',
            password='p',
            role=User.Role.FACULTY,
            is_staff=True
        )

        # Cohort
        self.cohort_sr = Cohort.objects.create(name='Seniors', code='SR')
        self.cohort_jr = Cohort.objects.create(name='Juniors', code='JR')

        # Students
        u1 = User.objects.create_user(username='alice_sr', email='a@test.edu', password='p', role=User.Role.STUDENT)
        self.s1 = Student.objects.create(user=u1, student_id='STU-A', cohort=self.cohort_sr, major='CS', academic_year='Senior', cgpa=3.9)

        u2 = User.objects.create_user(username='bob_jr', email='b@test.edu', password='p', role=User.Role.STUDENT)
        self.s2 = Student.objects.create(user=u2, student_id='STU-B', cohort=self.cohort_jr, major='CS', academic_year='Junior', cgpa=3.8)

        # Courses
        self.course_a = Course.objects.create(code='AI401', title='Artificial Intelligence', credits=4, department='CS')
        self.course_b = Course.objects.create(code='SEC402', title='Cybersecurity', credits=4, department='CS')

        # Section for AI401 with capacity 1
        Section.objects.create(course=self.course_a, section_number='01', term='Fall 2026', capacity=1, status=Section.Status.OPEN)
        # Section for SEC402 with capacity 2
        Section.objects.create(course=self.course_b, section_number='01', term='Fall 2026', capacity=2, status=Section.Status.OPEN)

        # Both students prefer AI401 as 1st choice, SEC402 as 2nd choice
        ElectivePreference.objects.create(student=self.s1, course=self.course_a, preference_rank=1, term='Fall 2026')
        ElectivePreference.objects.create(student=self.s1, course=self.course_b, preference_rank=2, term='Fall 2026')

        ElectivePreference.objects.create(student=self.s2, course=self.course_a, preference_rank=1, term='Fall 2026')
        ElectivePreference.objects.create(student=self.s2, course=self.course_b, preference_rank=2, term='Fall 2026')

    def test_execute_allocation_run_api_and_reproducibility(self):
        """
        POST /api/allocations/run/ executes batch matching.
        Senior (s1) wins the 1 seat in AI401; Junior (s2) gets their 2nd choice SEC402.
        Re-running with the same seed produces identical results.
        """
        self.client.force_authenticate(user=self.faculty_user)
        payload = {
            'term': 'Fall 2026',
            'seed': 'test-reproducible-seed-12345',
        }
        resp = self.client.post('/api/allocations/run/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        run_data = resp.json()['run']

        self.assertEqual(run_data['total_students'], 2)
        self.assertEqual(run_data['total_matched'], 2)

        # Results verification
        run_id = run_data['id']
        detail_resp = self.client.get(f'/api/allocations/{run_id}/')
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        results = detail_resp.json()['results']

        s1_res = next(r for r in results if r['student_id'] == 'STU-A')
        s2_res = next(r for r in results if r['student_id'] == 'STU-B')

        # Senior got 1st choice (AI401)
        self.assertEqual(s1_res['course_code'], 'AI401')
        self.assertEqual(s1_res['preference_rank'], 1)

        # Junior got 2nd choice (SEC402)
        self.assertEqual(s2_res['course_code'], 'SEC402')
        self.assertEqual(s2_res['preference_rank'], 2)

        # Verify reproducibility with second run using the same seed
        resp2 = self.client.post('/api/allocations/run/', payload, format='json')
        run2_id = resp2.json()['run']['id']
        detail2_resp = self.client.get(f'/api/allocations/{run2_id}/')
        results2 = detail2_resp.json()['results']

        s1_res2 = next(r for r in results2 if r['student_id'] == 'STU-A')
        s2_res2 = next(r for r in results2 if r['student_id'] == 'STU-B')

        self.assertEqual(s1_res['course_code'], s1_res2['course_code'])
        self.assertEqual(s2_res['course_code'], s2_res2['course_code'])
        self.assertEqual(s1_res['tiebreaker_value'], s1_res2['tiebreaker_value'])
        self.assertEqual(s2_res['tiebreaker_value'], s2_res2['tiebreaker_value'])

    def test_deadline_passed_locks_preferences(self):
        """If an elective course deadline has passed, preference modification is blocked with 403."""
        self.client.force_authenticate(user=self.s1.user)
        from django.utils import timezone
        from datetime import timedelta
        expired_course = Course.objects.create(
            code='EXP101',
            title='Expired Elective',
            department='Computer Science',
            credits=3,
            submission_deadline=timezone.now() - timedelta(days=2)
        )
        payload = {
            'course_ids': [expired_course.id],
            'term': 'Fall 2026',
            'student_id': self.s1.student_id,
        }
        resp = self.client.post('/api/preferences/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp.json()['code'], 'DEADLINE_PASSED')

    def test_max_choices_exceeded(self):
        """Submitting more than 5 preference choices returns 400 error."""
        self.client.force_authenticate(user=self.s1.user)
        courses = [
            Course.objects.create(code=f'TEST{i}', title=f'Course {i}', department='CS', credits=3)
            for i in range(1, 7)
        ]
        payload = {
            'course_ids': [c.id for c in courses],  # 6 courses
            'term': 'Fall 2026',
            'student_id': self.s1.student_id,
        }
        resp = self.client.post('/api/preferences/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['code'], 'MAX_CHOICES_EXCEEDED')

    def test_preferences_history_endpoint(self):
        """GET /api/preferences/history/ returns past preferences and allocation run results."""
        self.client.force_authenticate(user=self.s1.user)
        resp = self.client.get(f'/api/preferences/history/?student_id={self.s1.student_id}')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('preferences_history', resp.json())
        self.assertIn('allocations_history', resp.json())
