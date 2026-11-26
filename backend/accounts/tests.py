from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from .models import User, Student, Cohort


class AuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cohort = Cohort.objects.create(name='Junior Cohort', code='JUNIOR_2027')
        self.student_user = User.objects.create_user(
            username='stu_alex',
            email='alex.rivera@university.edu',
            first_name='Alex',
            last_name='Rivera',
            role=User.Role.STUDENT,
        )
        self.student = Student.objects.create(
            user=self.student_user,
            student_id='STU-2026-001',
            cohort=self.cohort,
            degree='B.Tech',
            branch='CSE',
            semester=5,
            cgpa=8.85,
            major='Computer Science',
            academic_year='Junior',
        )

        # Faculty account
        self.faculty_user = User.objects.create_user(
            username='faculty_cs',
            email='faculty.cs@university.edu',
            password='faculty123',
            first_name='Ada',
            last_name='Lovelace',
            role=User.Role.INSTRUCTOR,
        )

    def test_student_login_success(self):
        """Student logs in with Registration Number, Email and Turnstile token."""
        response = self.client.post(reverse('student-login'), {
            'registration_number': 'STU-2026-001',
            'email': 'alex.rivera@university.edu',
            'cf_turnstile_token': 'test-token',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['student']['student_id'], 'STU-2026-001')
        self.assertEqual(response.data['student']['name'], 'Alex Rivera')

    def test_student_login_email_mismatch(self):
        """Student login fails if registration number and email do not match."""
        response = self.client.post(reverse('student-login'), {
            'registration_number': 'STU-2026-001',
            'email': 'wrong.email@university.edu',
            'cf_turnstile_token': 'test-token',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('EmailMismatch', response.data['error'])

    def test_student_login_not_found(self):
        """Student login returns 404 with registration prompt if not found."""
        response = self.client.post(reverse('student-login'), {
            'registration_number': 'STU-UNKNOWN',
            'email': 'unknown@university.edu',
            'cf_turnstile_token': 'test-token',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(response.data['can_register'])

    def test_login_missing_turnstile_token_returns_400(self):
        """Manual login without Turnstile token returns 400 Bad Request."""
        response = self.client.post(reverse('student-login'), {
            'registration_number': 'STU-2026-001',
            'email': 'alex.rivera@university.edu',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'TurnstileError')

    def test_login_invalid_turnstile_token_returns_403(self):
        """Manual login with invalid Turnstile token returns 403 Forbidden."""
        response = self.client.post(reverse('student-login'), {
            'registration_number': 'STU-2026-001',
            'email': 'alex.rivera@university.edu',
            'cf_turnstile_token': 'invalid-token-123',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['error'], 'TurnstileError')

    def test_student_register_success(self):
        """New student registers with profile attributes without external OTP."""
        response = self.client.post(reverse('student-register'), {
            'registration_number': 'STU-2026-099',
            'email': 'new.student@university.edu',
            'name': 'Robin Sharma',
            'degree': 'B.Tech',
            'branch': 'CSE',
            'semester': 5,
            'cgpa': 8.5,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['student']['student_id'], 'STU-2026-099')
        self.assertEqual(response.data['student']['degree'], 'B.Tech')
        self.assertEqual(response.data['student']['semester'], 5)
        self.assertEqual(response.data['student']['cgpa'], 8.5)

    def test_student_register_duplicate(self):
        """Duplicate registration number rejected."""
        response = self.client.post(reverse('student-register'), {
            'registration_number': 'STU-2026-001',
            'email': 'different.email@university.edu',
            'name': 'Duplicate User',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_faculty_login_success(self):
        """Faculty logs in using pre-seeded username, password, and turnstile."""
        response = self.client.post(reverse('faculty-login'), {
            'username': 'faculty_cs',
            'password': 'faculty123',
            'cf_turnstile_token': 'test-token',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], 'INSTRUCTOR')
        self.assertEqual(response.data['user']['username'], 'faculty_cs')

    def test_faculty_login_invalid_password(self):
        """Faculty login fails with wrong password."""
        response = self.client.post(reverse('faculty-login'), {
            'username': 'faculty_cs',
            'password': 'wrongpassword',
            'cf_turnstile_token': 'test-token',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_student_profile_update(self):
        """Student updates their profile details."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.put(reverse('student-profile-update'), {
            'student_id': 'STU-2026-001',
            'name': 'Alexander Rivera',
            'degree': 'B.Tech (Honors)',
            'branch': 'CSE',
            'semester': 6,
            'cgpa': 9.1,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertEqual(self.student.degree, 'B.Tech (Honors)')
        self.assertEqual(self.student.semester, 6)
        self.assertEqual(self.student.cgpa, 9.1)

    def test_jwt_token_payload_contains_role_and_permissions(self):
        """JWT token payload contains user identity, role, and permissions."""
        from accounts.serializers import CustomTokenObtainPairSerializer
        import jwt
        from django.conf import settings

        token = CustomTokenObtainPairSerializer.get_token(self.student_user)
        access_token_str = str(token.access_token)
        payload = jwt.decode(access_token_str, settings.SECRET_KEY, algorithms=['HS256'])

        self.assertEqual(payload['username'], 'stu_alex')
        self.assertEqual(payload['email'], 'alex.rivera@university.edu')
        self.assertEqual(payload['role'], 'STUDENT')
        self.assertIn('can_submit_preferences', payload['permissions'])
        self.assertEqual(payload['student_id'], 'STU-2026-001')

    def test_unauthenticated_request_returns_401(self):
        """Protected endpoint returns 401 when unauthenticated."""
        response = self.client.get(reverse('current-user'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_token_returns_401(self):
        """Protected endpoint returns 401 when invalid token provided."""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid.fake.token')
        response = self.client.get(reverse('current-user'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_faculty_forbidden_from_student_profile_update(self):
        """Faculty account receives 403 Forbidden on student profile update."""
        self.client.force_authenticate(user=self.faculty_user)
        response = self.client.put(reverse('student-profile-update'), {
            'degree': 'Ph.D'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_complete_profile_endpoint(self):
        """User with profile_completed=False completes their student profile."""
        oauth_user = User.objects.create_user(
            username='oauth_new_user',
            email='oauth.new@gmail.com',
            role=User.Role.STUDENT,
            profile_completed=False,
            auth_provider=User.AuthProvider.GOOGLE,
        )
        self.client.force_authenticate(user=oauth_user)

        response = self.client.post('/api/auth/complete-profile/', {
            'name': 'Sam Altman',
            'registration_number': 'REG-OAUTH-001',
            'degree': 'B.Tech',
            'branch': 'Data Science',
            'semester': 6,
            'cgpa': 9.25,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        oauth_user.refresh_from_db()
        self.assertTrue(oauth_user.profile_completed)
        self.assertEqual(oauth_user.first_name, 'Sam')
        self.assertEqual(oauth_user.last_name, 'Altman')
        self.assertEqual(oauth_user.student_profile.student_id, 'REG-OAUTH-001')
        self.assertEqual(oauth_user.student_profile.branch, 'Data Science')
        self.assertEqual(oauth_user.student_profile.semester, 6)

    def test_google_and_github_login_redirect(self):
        """Google and GitHub login endpoints set state cookie and redirect to OAuth providers."""
        google_resp = self.client.get('/api/auth/google/login/')
        self.assertEqual(google_resp.status_code, status.HTTP_302_FOUND)
        self.assertIn('accounts.google.com', google_resp['Location'])
        self.assertIn('oauth_google_state', google_resp.cookies)

        github_resp = self.client.get('/api/auth/github/login/')
        self.assertEqual(github_resp.status_code, status.HTTP_302_FOUND)
        self.assertIn('github.com/login/oauth/authorize', github_resp['Location'])
        self.assertIn('oauth_github_state', github_resp.cookies)
