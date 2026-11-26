import uuid
from datetime import time, timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from accounts.models import User, Student, Cohort
from courses.models import (
    Course,
    Section,
    Registration,
    Prerequisite,
    StudentCourseHistory,
    ClassSchedule,
    RegistrationWindow,
    CartItem,
    EligibilitySnapshot,
)
from courses.services import (
    claim_seat_and_register,
    drop_registration,
    add_section_to_cart,
    SectionFullError,
    CourseConflictError,
    CreditLimitExceededError,
)
from courses.eligibility import (
    RegistrationWindowForbiddenError,
    PrerequisiteNotMetError,
    TimetableClashError,
    evaluate_course_eligibility,
    get_or_compute_eligibility_snapshot,
)


class CourseRegistrationServiceTests(TestCase):
    def setUp(self):
        # Create Cohort with active window
        self.cohort = Cohort.objects.create(name='Junior Cohort', code='JUNIOR')
        now = timezone.now()
        self.active_window = RegistrationWindow.objects.create(
            cohort=self.cohort,
            term='Fall 2026',
            start_time=now - timedelta(days=2),
            end_time=now + timedelta(days=10),
            status=RegistrationWindow.Status.ACTIVE
        )

        # Create users & students
        self.user1 = User.objects.create_user(
            username='student1',
            email='student1@test.edu',
            password='password123',
            first_name='Alice',
            last_name='Smith'
        )
        self.student1 = Student.objects.create(
            user=self.user1,
            student_id='STU001',
            cohort=self.cohort,
            max_credits=18
        )

        self.user2 = User.objects.create_user(
            username='student2',
            email='student2@test.edu',
            password='password123',
            first_name='Bob',
            last_name='Jones'
        )
        self.student2 = Student.objects.create(
            user=self.user2,
            student_id='STU002',
            cohort=self.cohort,
            max_credits=18
        )

        # Create Course
        self.course = Course.objects.create(
            code='CS101',
            title='Intro to Computer Science',
            department='Computer Science',
            credits=3
        )

        # Create Section with 1 seat capacity
        self.section_single_seat = Section.objects.create(
            course=self.course,
            section_number='01',
            term='Fall 2026',
            capacity=1,
            enrolled_count=0,
            status=Section.Status.OPEN
        )

        # Create Section with 30 seats capacity
        self.section_large = Section.objects.create(
            course=self.course,
            section_number='02',
            term='Fall 2026',
            capacity=30,
            enrolled_count=0,
            status=Section.Status.OPEN
        )

    def test_atomic_seat_claim_success(self):
        """Seat claim should increment enrolled_count and create Registration record."""
        reg, created = claim_seat_and_register(self.student1, self.section_large.id)
        self.assertTrue(created)
        self.assertEqual(reg.status, Registration.Status.REGISTERED)

        self.section_large.refresh_from_db()
        self.assertEqual(self.section_large.enrolled_count, 1)
        self.assertEqual(self.section_large.available_seats, 29)

    def test_idempotent_registration_same_student_section(self):
        """Calling claim_seat_and_register twice for the same student/section is idempotent."""
        key = str(uuid.uuid4())
        reg1, created1 = claim_seat_and_register(self.student1, self.section_large.id, idempotency_key=key)
        self.assertTrue(created1)

        self.section_large.refresh_from_db()
        self.assertEqual(self.section_large.enrolled_count, 1)

        # Re-register with the same key
        reg2, created2 = claim_seat_and_register(self.student1, self.section_large.id, idempotency_key=key)
        self.assertFalse(created2)
        self.assertEqual(reg1.id, reg2.id)

        # Seat count must NOT increment again
        self.section_large.refresh_from_db()
        self.assertEqual(self.section_large.enrolled_count, 1)

    def test_section_full_raises_error(self):
        """When section is full, subsequent seat claim must raise SectionFullError."""
        claim_seat_and_register(self.student1, self.section_single_seat.id)
        self.section_single_seat.refresh_from_db()
        self.assertEqual(self.section_single_seat.enrolled_count, 1)
        self.assertEqual(self.section_single_seat.status, Section.Status.CLOSED)

        # Student 2 attempts to claim seat in full section
        with self.assertRaises(SectionFullError):
            claim_seat_and_register(self.student2, self.section_single_seat.id)

        self.section_single_seat.refresh_from_db()
        self.assertEqual(self.section_single_seat.enrolled_count, 1)

    def test_course_conflict_prevention(self):
        """Student cannot register for two sections of the same course in the same term."""
        course_multi = Course.objects.create(code='MATH101', title='Calculus I', credits=4)
        sec_a = Section.objects.create(course=course_multi, section_number='01', term='Fall 2026', capacity=10)
        sec_b = Section.objects.create(course=course_multi, section_number='02', term='Fall 2026', capacity=10)

        claim_seat_and_register(self.student1, sec_a.id)

        with self.assertRaises(CourseConflictError):
            claim_seat_and_register(self.student1, sec_b.id)

    def test_credit_limit_exceeded(self):
        """Student cannot exceed max allowed credits."""
        heavy_course = Course.objects.create(code='HEAVY999', title='Heavy Project', credits=20)
        sec = Section.objects.create(course=heavy_course, section_number='01', term='Fall 2026', capacity=10)

        with self.assertRaises(CreditLimitExceededError):
            claim_seat_and_register(self.student1, sec.id)

    def test_drop_registration_frees_seat(self):
        """Dropping a registration decrements enrolled count and reopens section if closed."""
        reg, _ = claim_seat_and_register(self.student1, self.section_single_seat.id)
        self.section_single_seat.refresh_from_db()
        self.assertEqual(self.section_single_seat.enrolled_count, 1)
        self.assertEqual(self.section_single_seat.status, Section.Status.CLOSED)

        # Drop
        dropped = drop_registration(self.student1, reg.id)
        self.assertEqual(dropped.status, Registration.Status.DROPPED)

        self.section_single_seat.refresh_from_db()
        self.assertEqual(self.section_single_seat.enrolled_count, 0)
        self.assertEqual(self.section_single_seat.status, Section.Status.OPEN)

    def test_over_enrollment_prevention_on_capacity(self):
        """Even if 5 different students attempt to claim a single seat, exactly 1 wins."""
        students = [self.student1, self.student2]
        for i in range(3, 6):
            u = User.objects.create_user(username=f'stu{i}', email=f'stu{i}@test.edu', password='p')
            students.append(Student.objects.create(user=u, student_id=f'STU00{i}', cohort=self.cohort, max_credits=18))

        success_count = 0
        failure_count = 0

        for student in students:
            try:
                reg, created = claim_seat_and_register(student, self.section_single_seat.id)
                if created:
                    success_count += 1
            except SectionFullError:
                failure_count += 1

        self.assertEqual(success_count, 1)
        self.assertEqual(failure_count, 4)
        self.section_single_seat.refresh_from_db()
        self.assertEqual(self.section_single_seat.enrolled_count, 1)


class Phase2EligibilityEngineTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        now = timezone.now()

        # Cohorts & Windows
        self.cohort_active = Cohort.objects.create(name='Active Cohort', code='ACTIVE_C')
        self.cohort_upcoming = Cohort.objects.create(name='Upcoming Cohort', code='UPCOMING_C')
        self.cohort_closed = Cohort.objects.create(name='Closed Cohort', code='CLOSED_C')

        # Windows
        RegistrationWindow.objects.create(
            cohort=self.cohort_active,
            term='Fall 2026',
            start_time=now - timedelta(days=2),
            end_time=now + timedelta(days=5),
            status=RegistrationWindow.Status.ACTIVE
        )
        RegistrationWindow.objects.create(
            cohort=self.cohort_upcoming,
            term='Fall 2026',
            start_time=now + timedelta(days=3),
            end_time=now + timedelta(days=10),
            status=RegistrationWindow.Status.UPCOMING
        )
        RegistrationWindow.objects.create(
            cohort=self.cohort_closed,
            term='Fall 2026',
            start_time=now - timedelta(days=10),
            end_time=now - timedelta(days=1),
            status=RegistrationWindow.Status.CLOSED
        )

        # Students
        self.u_active = User.objects.create_user(username='stu_active', email='active@test.edu', password='p', role=User.Role.STUDENT)
        self.student_active = Student.objects.create(user=self.u_active, student_id='STU-ACT', cohort=self.cohort_active, max_credits=18)

        self.u_upcoming = User.objects.create_user(username='stu_upcoming', email='upcoming@test.edu', password='p', role=User.Role.STUDENT)
        self.student_upcoming = Student.objects.create(user=self.u_upcoming, student_id='STU-UP', cohort=self.cohort_upcoming, max_credits=18)

        # Faculty
        self.faculty_user = User.objects.create_user(
            username='fac_prof',
            email='prof@test.edu',
            password='p',
            role=User.Role.FACULTY,
            is_staff=True
        )

        # Courses & Prerequisites: CS201 requires CS101
        self.cs101 = Course.objects.create(code='CS101', title='Intro to CS', department='CS', credits=4)
        self.cs201 = Course.objects.create(code='CS201', title='Data Structures', department='CS', credits=4)
        Prerequisite.objects.create(course=self.cs201, prerequisite_course=self.cs101, min_grade='C')

        # Sections
        self.sec_cs101 = Section.objects.create(course=self.cs101, section_number='01', term='Fall 2026', capacity=30)
        self.sec_cs201 = Section.objects.create(course=self.cs201, section_number='01', term='Fall 2026', capacity=30)

        # Schedules: CS101 is Mon 10:00 - 11:30 AM
        ClassSchedule.objects.create(
            section=self.sec_cs101,
            day='MON',
            start_time=time(10, 0),
            end_time=time(11, 30),
            location='Hall A'
        )

        # Section with clashing schedule: Mon 10:30 - 12:00 PM
        self.sec_clash = Section.objects.create(course=self.cs201, section_number='02', term='Fall 2026', capacity=30)
        ClassSchedule.objects.create(
            section=self.sec_clash,
            day='MON',
            start_time=time(10, 30),
            end_time=time(12, 0),
            location='Hall B'
        )

        # Section without clash: Tue 10:00 - 11:30 AM
        self.sec_no_clash = Section.objects.create(course=self.cs201, section_number='03', term='Fall 2026', capacity=30)
        ClassSchedule.objects.create(
            section=self.sec_no_clash,
            day='TUE',
            start_time=time(10, 0),
            end_time=time(11, 30),
            location='Hall C'
        )

    def test_registration_window_gating_returns_403(self):
        """Students outside active registration window receive HTTP 403 Forbidden."""
        self.client.force_authenticate(user=self.u_upcoming)
        payload = {
            'section_id': self.sec_cs101.id,
            'student_id': self.student_upcoming.student_id,
        }
        resp = self.client.post('/api/registrations/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp.json()['error'], 'RegistrationWindowForbidden')

    def test_missing_prerequisite_blocks_registration(self):
        """Attempting to register for CS201 without passing CS101 raises PrerequisiteNotMetError."""
        self.client.force_authenticate(user=self.u_active)
        # Active student has NOT completed CS101 yet
        payload = {
            'section_id': self.sec_cs201.id,
            'student_id': self.student_active.student_id,
        }
        resp = self.client.post('/api/registrations/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['error'], 'PrerequisiteNotMetError')
        self.assertIn('Missing Prerequisite: CS101', resp.json()['detail'])

    def test_satisfied_prerequisite_allows_registration(self):
        """Once student has passed CS101, registration for CS201 succeeds."""
        self.client.force_authenticate(user=self.u_active)
        # Record passed history for CS101
        StudentCourseHistory.objects.create(
            student=self.student_active,
            course=self.cs101,
            grade='A',
            passed=True
        )

        payload = {
            'section_id': self.sec_no_clash.id,
            'student_id': self.student_active.student_id,
        }
        resp = self.client.post('/api/registrations/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.json()['registration']['status'], 'REGISTERED')

    def test_timetable_clash_detection_blocks_registration(self):
        """Enrolling in a section that overlaps with an already registered section raises TimetableClashError (409 Conflict)."""
        self.client.force_authenticate(user=self.u_active)
        # Enroll in CS101 (Mon 10:00 - 11:30)
        claim_seat_and_register(self.student_active, self.sec_cs101.id)

        # Grant CS101 prerequisite completion so prereq check passes
        StudentCourseHistory.objects.create(
            student=self.student_active,
            course=self.cs101,
            grade='B',
            passed=True
        )

        # Attempt to enroll in sec_clash (Mon 10:30 - 12:00)
        payload = {
            'section_id': self.sec_clash.id,
            'student_id': self.student_active.student_id,
        }
        resp = self.client.post('/api/registrations/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.json()['error'], 'TimetableClashError')
        self.assertIn('Timetable Clash', resp.json()['detail'])

    def test_eligibility_snapshot_computation_and_endpoint(self):
        """GET /api/eligibility/ accurately reports course and section eligibility details."""
        self.client.force_authenticate(user=self.u_active)
        resp = self.client.get(
            f'/api/eligibility/?student_id={self.student_active.student_id}&course_id={self.cs201.id}'
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()

        # Should be ineligible because CS101 prerequisite is not met
        self.assertFalse(data['eligible'])
        self.assertFalse(data['prerequisites_status']['satisfied'])
        self.assertTrue(len(data['prerequisites_status']['missing']) > 0)

    def test_cart_workflow_prerequisite_and_clash_validation(self):
        """Adding section with missing prerequisite to cart returns 400 Bad Request."""
        self.client.force_authenticate(user=self.u_active)
        payload = {
            'section_id': self.sec_cs201.id,
            'student_id': self.student_active.student_id,
        }
        resp = self.client.post('/api/cart/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['error'], 'PrerequisiteNotMetError')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['error'], 'PrerequisiteNotMetError')

    def test_faculty_elective_rules_and_eligibility_evaluation(self):
        """
        Eligibility evaluation checks flexible faculty rules (CGPA, Branch, Semester, Degree)
        and displays clear user-facing error messages if ineligible.
        """
        # Create elective course with strict CGPA and branch requirements
        strict_course = Course.objects.create(
            code='AI900',
            title='Advanced Artificial Intelligence',
            department='Computer Science',
            credits=3,
            category=Course.Category.DEPARTMENT,
            target_degrees=['B.Tech'],
            target_branches=['CSE'],
            min_cgpa=9.0,  # Requires >= 9.0 CGPA
            allowed_semesters=[7, 8],  # Only 7th and 8th semester
        )
        Section.objects.create(
            course=strict_course,
            section_number='01',
            term='Fall 2026',
            capacity=10,
            status=Section.Status.OPEN
        )

        # Student has CGPA 3.5/8.0 (below 9.0) and is semester 5 (not in [7, 8])
        eval_result = evaluate_course_eligibility(self.student_active, strict_course, term='Fall 2026')
        self.assertFalse(eval_result['eligible'])
        
        reasons_text = " ".join(eval_result['reasons'])
        self.assertIn('Minimum CGPA of 9.00 required', reasons_text)
        self.assertIn('Open only to Semester(s) 7, 8', reasons_text)

    def test_faculty_course_create_with_flexible_rules(self):
        """Faculty can create an elective course with optional flexible rules and section capacity."""
        self.client.force_authenticate(user=self.faculty_user)
        payload = {
            'code': 'ROB301',
            'title': 'Autonomous Mobile Robotics',
            'description': 'Perception and state estimation in robotics.',
            'department': 'Mechanical',
            'credits': 3,
            'category': 'OPEN',
            'target_degrees': ['B.Tech', 'M.Tech'],
            'target_branches': ['CSE', 'Mechanical'],
            'min_cgpa': 7.5,
            'allowed_semesters': [5, 6, 7],
            'max_preferences': 5,
            'capacity': 25,
        }
        resp = self.client.post('/api/courses/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.json()['code'], 'ROB301')
        self.assertEqual(resp.json()['category'], 'OPEN')
        
        # Verify default section 01 was automatically created with capacity 25
        created_course = Course.objects.get(code='ROB301')
        self.assertEqual(created_course.sections.count(), 1)
        self.assertEqual(created_course.sections.first().capacity, 25)

    def test_elective_step_by_step_creation_and_draft_restoration(self):
        """
        Verify multi-step elective wizard:
        - Step 1: Saves basic details (Title, Description, Deadline, Term) as draft.
        - Step 2: Saves dynamic courses, requires at least 2 courses with individual seats/cutoffs.
        - Step 3: Saves whole-elective criteria and finalizes draft.
        - Verifies students cannot see drafts, but faculty can restore drafts.
        """
        self.client.force_authenticate(user=self.faculty_user)
        future_deadline = (timezone.now() + timezone.timedelta(days=7)).isoformat()

        # Step 1: Save basic info
        step1_payload = {
            'title': 'AI & Robotics Basket',
            'description': 'Advanced electives for senior students.',
            'submission_deadline': future_deadline,
            'term': 'Fall 2026',
            'department': 'Computer Science',
        }
        resp1 = self.client.post('/api/electives/save-step-1/', step1_payload, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        draft_data = resp1.json()
        draft_id = draft_data['id']
        self.assertTrue(draft_data['is_draft'])
        self.assertEqual(draft_data['current_step'], 1)
        self.assertEqual(draft_data['title'], 'AI & Robotics Basket')

        # Students should NOT see this draft
        self.client.force_authenticate(user=self.student_active.user)
        student_resp = self.client.get('/api/electives/')
        self.assertEqual(len([e for e in student_resp.json() if e['id'] == draft_id]), 0)

        # Faculty resumes editing draft: Step 2 with < 2 courses should fail
        self.client.force_authenticate(user=self.faculty_user)
        invalid_step2_payload = {
            'courses': [
                {'code': 'AI501', 'title': 'Deep Learning', 'credits': 4, 'capacity': 40, 'min_cgpa': 8.0}
            ]
        }
        resp2_invalid = self.client.post(f'/api/electives/{draft_id}/save-step-2/', invalid_step2_payload, format='json')
        self.assertEqual(resp2_invalid.status_code, status.HTTP_400_BAD_REQUEST)

        # Step 2 with 2 valid courses
        step2_payload = {
            'courses': [
                {'code': 'AI501', 'title': 'Deep Learning', 'credits': 4, 'capacity': 40, 'min_cgpa': 8.0},
                {'code': 'ROB502', 'title': 'Robotic Navigation', 'credits': 3, 'capacity': 30, 'min_cgpa': 7.5},
            ]
        }
        resp2 = self.client.post(f'/api/electives/{draft_id}/save-step-2/', step2_payload, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        step2_data = resp2.json()
        self.assertEqual(step2_data['current_step'], 2)
        self.assertEqual(step2_data['total_courses'], 2)

        # Step 3: Save whole-elective criteria without finalizing (Save Draft)
        step3_draft_payload = {
            'min_cgpa': 7.0,
            'allowed_semesters': [5, 6, 7],
            'target_degrees': ['B.Tech'],
            'target_branches': ['CSE', 'ECE'],
            'max_preferences': 3,
            'finalize': False,
        }
        resp3_draft = self.client.post(f'/api/electives/{draft_id}/save-step-3/', step3_draft_payload, format='json')
        self.assertEqual(resp3_draft.status_code, status.HTTP_200_OK)
        self.assertTrue(resp3_draft.json()['is_draft'])
        self.assertEqual(resp3_draft.json()['current_step'], 3)

        # Restore draft: fetch draft by id
        restore_resp = self.client.get(f'/api/electives/{draft_id}/')
        self.assertEqual(restore_resp.status_code, status.HTTP_200_OK)
        restored = restore_resp.json()
        self.assertEqual(restored['title'], 'AI & Robotics Basket')
        self.assertEqual(len(restored['courses']), 2)
        self.assertEqual(restored['min_cgpa'], 7.0)

        # Finalize draft (Launch Elective)
        finalize_payload = {
            'min_cgpa': 7.0,
            'allowed_semesters': [5, 6, 7],
            'target_degrees': ['B.Tech'],
            'target_branches': ['CSE', 'ECE'],
            'max_preferences': 3,
            'finalize': True,
        }
        resp_finalize = self.client.post(f'/api/electives/{draft_id}/save-step-3/', finalize_payload, format='json')
        self.assertEqual(resp_finalize.status_code, status.HTTP_200_OK)
        finalized_data = resp_finalize.json()
        self.assertFalse(finalized_data['is_draft'])

        # Now student CAN see this elective
        self.client.force_authenticate(user=self.student_active.user)
        student_resp2 = self.client.get('/api/electives/')
        matching = [e for e in student_resp2.json() if e['id'] == draft_id]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0]['title'], 'AI & Robotics Basket')
