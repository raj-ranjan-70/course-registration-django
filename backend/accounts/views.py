import logging
import secrets
import time
import urllib.parse
import requests
import jwt
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import authenticate, login, logout
from django.http import HttpResponseRedirect
from django.conf import settings
from django.utils.text import slugify
from .models import User, Student, Cohort
from .permissions import IsFacultyUser, IsStudentUser
from .turnstile import verify_turnstile
from .serializers import (
    UserSerializer,
    StudentProfileDetailSerializer,
    CustomTokenObtainPairSerializer,
    StudentLoginSerializer,
    StudentRegisterSerializer,
    FacultyLoginSerializer,
    StudentUpdateProfileSerializer,
    CompleteProfileSerializer,
    get_user_role_and_permissions,
)

logger = logging.getLogger(__name__)


class LoginView(TokenObtainPairView):
    """
    Dedicated JWT Login: Authenticates faculty or students via username, email,
    or student registration number and password. Requires Turnstile verification.
    Establishes Django session, sets HTTP-only cookie, and returns tokens + user details.
    """
    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        cf_token = request.data.get('cf_turnstile_token')
        valid, err_msg, status_code = verify_turnstile(cf_token, request.META.get('REMOTE_ADDR'))
        if not valid:
            return Response({'error': 'TurnstileError', 'detail': err_msg}, status=status_code)

        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            user_id = response.data.get('user', {}).get('id')
            user = User.objects.filter(id=user_id).first() if user_id else None
            if user:
                login(request, user)
            access = response.data.get('access')
            if access:
                response.set_cookie('access_token', access, httponly=True, samesite='Lax', secure=False)
        return response


class StudentLoginView(APIView):
    """
    Dedicated Student Login: Authenticates students using Registration Number and Password (or Email).
    Requires Turnstile verification. Sets session cookie & returns JWT tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        cf_token = request.data.get('cf_turnstile_token')
        valid, err_msg, status_code = verify_turnstile(cf_token, request.META.get('REMOTE_ADDR'))
        if not valid:
            return Response({'error': 'TurnstileError', 'detail': err_msg}, status=status_code)

        serializer = StudentLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        reg_no = serializer.validated_data.get('registration_number', '').strip()
        password = serializer.validated_data.get('password')
        email = serializer.validated_data.get('email', '').strip().lower()

        student = Student.objects.filter(student_id__iexact=reg_no).select_related('user', 'cohort').first()
        if not student:
            return Response(
                {
                    'error': 'AccountNotFound',
                    'detail': f"No student account found for Registration Number '{reg_no}'. Please complete registration.",
                    'can_register': True,
                },
                status=status.HTTP_404_NOT_FOUND
            )

        user = student.user
        if password:
            authenticated_user = authenticate(username=user.username, password=password)
            if not authenticated_user:
                return Response(
                    {'error': 'InvalidPassword', 'detail': 'Incorrect password.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            user = authenticated_user
        elif email:
            if user.email.strip().lower() != email:
                return Response(
                    {
                        'error': 'EmailMismatch',
                        'detail': f"Provided email does not match registered email for student ID '{reg_no}'.",
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        login(request, user)
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        role, permissions = get_user_role_and_permissions(user)

        response = Response({
            'status': 'success',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'message': f"Welcome back, {user.get_full_name() or user.username}!",
            'user': UserSerializer(user).data,
            'student': StudentProfileDetailSerializer(student).data,
            'role': role,
            'permissions': permissions,
        }, status=status.HTTP_200_OK)
        response.set_cookie('access_token', str(refresh.access_token), httponly=True, samesite='Lax', secure=False)
        return response


class StudentRegisterView(APIView):
    """
    Dedicated Student Registration:
    Registers a new student with Registration Number, Email, Password, and academic profile.
    Issues JWT access & refresh tokens immediately upon registration.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = StudentRegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        reg_no = serializer.validated_data['registration_number'].strip()
        email = serializer.validated_data['email'].strip().lower()
        password = serializer.validated_data['password']
        name = serializer.validated_data['name'].strip()
        degree = serializer.validated_data.get('degree', 'B.Tech').strip()
        branch = serializer.validated_data.get('branch', 'CSE').strip()
        semester = serializer.validated_data.get('semester', 5)
        cgpa = serializer.validated_data.get('cgpa', 8.0)

        # Check for existing student_id
        if Student.objects.filter(student_id__iexact=reg_no).exists():
            return Response(
                {'error': 'DuplicateRegistrationNumber', 'detail': f"Registration Number '{reg_no}' is already in use."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check for existing email
        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {'error': 'DuplicateEmail', 'detail': f"Email '{email}' is already registered with another account."},
                status=status.HTTP_400_BAD_REQUEST
            )

        name_parts = name.split()
        first_name = name_parts[0] if name_parts else ''
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ''

        base_username = slugify(name) or slugify(reg_no) or 'student'
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=User.Role.STUDENT,
            profile_completed=True,
            auth_provider=User.AuthProvider.MANUAL,
        )

        cohort_code = 'JUNIOR_2027' if semester in [5, 6] else ('SOPHOMORE_2028' if semester in [3, 4] else 'SENIOR_2026')
        cohort = Cohort.objects.filter(code=cohort_code).first() or Cohort.objects.first()

        academic_year = 'Junior' if semester in [5, 6] else ('Sophomore' if semester in [3, 4] else ('Senior' if semester >= 7 else 'Freshman'))

        student = Student.objects.create(
            user=user,
            student_id=reg_no,
            cohort=cohort,
            degree=degree,
            branch=branch,
            semester=semester,
            major=branch,
            academic_year=academic_year,
            cgpa=cgpa,
            profile_completed=True,
        )

        login(request, user)
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        role, permissions = get_user_role_and_permissions(user)

        response = Response({
            'status': 'success',
            'message': f"Student account created successfully for {name} ({reg_no}).",
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
            'student': StudentProfileDetailSerializer(student).data,
            'role': role,
            'permissions': permissions,
        }, status=status.HTTP_201_CREATED)
        response.set_cookie('access_token', str(refresh.access_token), httponly=True, samesite='Lax', secure=False)
        return response


class FacultyLoginView(APIView):
    """
    Dedicated Faculty Login: Authenticates instructors and admins via credentials.
    Requires Turnstile verification. Sets session cookie & returns JWT tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        cf_token = request.data.get('cf_turnstile_token')
        valid, err_msg, status_code = verify_turnstile(cf_token, request.META.get('REMOTE_ADDR'))
        if not valid:
            return Response({'error': 'TurnstileError', 'detail': err_msg}, status=status_code)

        serializer = FacultyLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data['user']
        login(request, user)
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        role, permissions = get_user_role_and_permissions(user)

        response = Response({
            'status': 'success',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'message': f"Welcome, {user.get_full_name() or user.username}!",
            'user': UserSerializer(user).data,
            'role': user.role if user.role == 'INSTRUCTOR' else role,
            'permissions': permissions,
        }, status=status.HTTP_200_OK)
        response.set_cookie('access_token', str(refresh.access_token), httponly=True, samesite='Lax', secure=False)
        return response


class GoogleLoginView(APIView):
    """
    Initiates Google OAuth 2.0 + OIDC authentication flow.
    Generates cryptographic state and nonce stored in short-lived HTTP-only cookies.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)
        params = {
            'client_id': settings.GOOGLE_CLIENT_ID,
            'redirect_uri': settings.GOOGLE_REDIRECT_URI,
            'response_type': 'code',
            'scope': 'openid email profile',
            'state': state,
            'nonce': nonce,
            'prompt': 'select_account',
            'access_type': 'online',
        }
        auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode(params)
        response = HttpResponseRedirect(auth_url)
        response.set_cookie('oauth_google_state', state, max_age=600, httponly=True, samesite='Lax', secure=False)
        response.set_cookie('oauth_google_nonce', nonce, max_age=600, httponly=True, samesite='Lax', secure=False)
        return response


class GoogleCallbackView(APIView):
    """
    Handles Google OAuth 2.0 + OIDC callback.
    Validates state cookie, exchanges code for tokens, verifies OIDC id_token claims,
    and logs in existing user or creates new user with profile_completed = False.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        error = request.GET.get('error')
        if error:
            logger.warning("Google OAuth error: %s", error)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=GoogleAuthCancelled")

        code = request.GET.get('code')
        state = request.GET.get('state')
        expected_state = request.COOKIES.get('oauth_google_state')

        if not state or not expected_state or state != expected_state:
            logger.error("Google OAuth state mismatch: %s vs %s", state, expected_state)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=InvalidOAuthState")

        if not code:
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=MissingAuthCode")

        # Exchange code for tokens
        token_data = {
            'client_id': settings.GOOGLE_CLIENT_ID,
            'client_secret': settings.GOOGLE_CLIENT_SECRET,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': settings.GOOGLE_REDIRECT_URI,
        }
        try:
            token_resp = requests.post('https://oauth2.googleapis.com/token', data=token_data, timeout=10.0)
            token_json = token_resp.json()
        except Exception as exc:
            logger.error("Failed to exchange Google OAuth code: %s", exc)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=TokenExchangeFailed")

        id_token_str = token_json.get('id_token')
        if not id_token_str:
            logger.error("No id_token in Google response: %s", token_json)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=NoIdTokenReturned")

        # Decode claims
        try:
            claims = jwt.decode(id_token_str, options={"verify_signature": False})
        except Exception as exc:
            logger.error("Failed to decode Google id_token: %s", exc)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=InvalidIdToken")

        # Validate issuer, audience, exp
        iss = claims.get('iss')
        if iss not in ('https://accounts.google.com', 'accounts.google.com'):
            logger.error("Invalid Google id_token issuer: %s", iss)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=InvalidIssuer")

        aud = claims.get('aud')
        if aud != settings.GOOGLE_CLIENT_ID:
            logger.error("Invalid Google id_token audience: %s", aud)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=InvalidAudience")

        exp = claims.get('exp')
        if not exp or exp < time.time():
            logger.error("Google id_token expired: %s", exp)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=TokenExpired")

        email = claims.get('email', '').strip().lower()
        if not email:
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=NoEmailFromGoogle")

        email_verified = claims.get('email_verified')
        if not email_verified:
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=UnverifiedGoogleEmail")

        sub = claims.get('sub')
        given_name = claims.get('given_name', '')
        family_name = claims.get('family_name', '')
        name = claims.get('name') or f"{given_name} {family_name}".strip()

        # Look up user by normalized email
        user = User.objects.filter(email=email).first()
        is_new_user = False
        if user:
            if not user.provider_id:
                user.provider_id = sub
                user.save(update_fields=['provider_id'])
        else:
            is_new_user = True
            base_username = slugify(name) or email.split('@')[0] or 'google_user'
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

            user = User.objects.create(
                username=username,
                email=email,
                first_name=given_name,
                last_name=family_name,
                role=User.Role.STUDENT,
                auth_provider=User.AuthProvider.GOOGLE,
                provider_id=sub,
                profile_completed=False,
            )
            user.set_unusable_password()
            user.save()

        login(request, user)
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        access_jwt = str(refresh.access_token)

        if not user.profile_completed or is_new_user:
            redirect_url = f"{settings.FRONTEND_URL}/complete-profile?token={access_jwt}&refresh={str(refresh)}"
        else:
            redirect_url = f"{settings.FRONTEND_URL}/dashboard?token={access_jwt}&refresh={str(refresh)}"

        response = HttpResponseRedirect(redirect_url)
        response.set_cookie('access_token', access_jwt, httponly=True, samesite='Lax', secure=False)
        response.delete_cookie('oauth_google_state')
        response.delete_cookie('oauth_google_nonce')
        return response


class GitHubLoginView(APIView):
    """
    Initiates GitHub OAuth 2.0 authentication flow.
    Generates cryptographic state stored in short-lived HTTP-only cookie.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        state = secrets.token_urlsafe(32)
        params = {
            'client_id': settings.GITHUB_CLIENT_ID,
            'redirect_uri': settings.GITHUB_REDIRECT_URI,
            'scope': 'read:user user:email',
            'state': state,
        }
        auth_url = 'https://github.com/login/oauth/authorize?' + urllib.parse.urlencode(params)
        response = HttpResponseRedirect(auth_url)
        response.set_cookie('oauth_github_state', state, max_age=600, httponly=True, samesite='Lax', secure=False)
        return response


class GitHubCallbackView(APIView):
    """
    Handles GitHub OAuth 2.0 callback.
    Validates state, exchanges code for access_token, retrieves user profile & emails,
    and logs in existing user or creates new user with profile_completed = False.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        error = request.GET.get('error')
        if error:
            logger.warning("GitHub OAuth error: %s", error)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=GitHubAuthFailed")

        code = request.GET.get('code')
        state = request.GET.get('state')
        expected_state = request.COOKIES.get('oauth_github_state')

        if not state or not expected_state or state != expected_state:
            logger.error("GitHub OAuth state mismatch: %s vs %s", state, expected_state)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=InvalidOAuthState")

        if not code:
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=MissingAuthCode")

        try:
            token_resp = requests.post(
                'https://github.com/login/oauth/access_token',
                headers={'Accept': 'application/json'},
                data={
                    'client_id': settings.GITHUB_CLIENT_ID,
                    'client_secret': settings.GITHUB_CLIENT_SECRET,
                    'code': code,
                    'redirect_uri': settings.GITHUB_REDIRECT_URI,
                },
                timeout=10.0
            )
            token_json = token_resp.json()
        except Exception as exc:
            logger.error("Failed to exchange GitHub OAuth code: %s", exc)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=TokenExchangeFailed")

        gh_access_token = token_json.get('access_token')
        if not gh_access_token:
            logger.error("No access_token returned by GitHub: %s", token_json)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=NoAccessTokenReturned")

        headers = {
            'Authorization': f"Bearer {gh_access_token}",
            'User-Agent': 'ElectiveCourseRegistrationApp',
            'Accept': 'application/vnd.github.v3+json',
        }
        try:
            user_resp = requests.get('https://api.github.com/user', headers=headers, timeout=10.0)
            user_json = user_resp.json()
        except Exception as exc:
            logger.error("Failed to fetch GitHub user profile: %s", exc)
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=UserProfileFetchFailed")

        gh_id = str(user_json.get('id', ''))
        name = user_json.get('name') or user_json.get('login') or 'GitHub User'
        email = user_json.get('email')

        # Fallback to /user/emails if primary email is private
        if not email:
            try:
                emails_resp = requests.get('https://api.github.com/user/emails', headers=headers, timeout=10.0)
                emails_json = emails_resp.json()
                if isinstance(emails_json, list):
                    for em in emails_json:
                        if em.get('primary') and em.get('verified'):
                            email = em.get('email')
                            break
                    if not email and emails_json:
                        email = emails_json[0].get('email')
            except Exception as exc:
                logger.error("Failed to fetch GitHub emails: %s", exc)

        if not email:
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?error=NoEmailFoundInGitHub")

        email = email.strip().lower()
        name_parts = name.split()
        first_name = name_parts[0] if name_parts else ''
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ''

        user = User.objects.filter(email=email).first()
        is_new_user = False
        if user:
            if not user.provider_id:
                user.provider_id = gh_id
                user.save(update_fields=['provider_id'])
        else:
            is_new_user = True
            base_username = slugify(user_json.get('login') or name) or email.split('@')[0] or 'github_user'
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

            user = User.objects.create(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=User.Role.STUDENT,
                auth_provider=User.AuthProvider.GITHUB,
                provider_id=gh_id,
                profile_completed=False,
            )
            user.set_unusable_password()
            user.save()

        login(request, user)
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        access_jwt = str(refresh.access_token)

        if not user.profile_completed or is_new_user:
            redirect_url = f"{settings.FRONTEND_URL}/complete-profile?token={access_jwt}&refresh={str(refresh)}"
        else:
            redirect_url = f"{settings.FRONTEND_URL}/dashboard?token={access_jwt}&refresh={str(refresh)}"

        response = HttpResponseRedirect(redirect_url)
        response.set_cookie('access_token', access_jwt, httponly=True, samesite='Lax', secure=False)
        response.delete_cookie('oauth_github_state')
        return response


class CompleteProfileView(APIView):
    """
    Authenticated route for users with profile_completed == False.
    Accepts student registration profile fields, saves them, sets profile_completed = True,
    and returns the updated user and student object.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        serializer = CompleteProfileSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        reg_no = serializer.validated_data['registration_number'].strip()
        name = serializer.validated_data['name'].strip()
        degree = serializer.validated_data.get('degree', 'B.Tech').strip()
        branch = serializer.validated_data.get('branch', 'CSE').strip()
        semester = serializer.validated_data.get('semester', 5)
        cgpa = serializer.validated_data.get('cgpa', 8.0)

        # Check for duplicate registration number
        existing = Student.objects.filter(student_id__iexact=reg_no).exclude(user=user).first()
        if existing:
            return Response(
                {
                    'error': 'DuplicateRegistrationNumber',
                    'detail': f"Registration Number '{reg_no}' is already assigned to another student."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        name_parts = name.split()
        user.first_name = name_parts[0] if name_parts else ''
        user.last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ''
        user.profile_completed = True
        user.save()

        cohort_code = 'JUNIOR_2027' if semester in [5, 6] else ('SOPHOMORE_2028' if semester in [3, 4] else 'SENIOR_2026')
        cohort = Cohort.objects.filter(code=cohort_code).first() or Cohort.objects.first()
        academic_year = 'Junior' if semester in [5, 6] else ('Sophomore' if semester in [3, 4] else ('Senior' if semester >= 7 else 'Freshman'))

        student, _ = Student.objects.update_or_create(
            user=user,
            defaults={
                'student_id': reg_no,
                'cohort': cohort,
                'degree': degree,
                'branch': branch,
                'major': branch,
                'semester': semester,
                'academic_year': academic_year,
                'cgpa': cgpa,
                'profile_completed': True,
            }
        )

        refresh = CustomTokenObtainPairSerializer.get_token(user)
        role, permissions = get_user_role_and_permissions(user)

        response = Response({
            'status': 'success',
            'message': 'Profile completed successfully.',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
            'student': StudentProfileDetailSerializer(student).data,
            'role': role,
            'permissions': permissions,
        }, status=status.HTTP_200_OK)
        response.set_cookie('access_token', str(refresh.access_token), httponly=True, samesite='Lax', secure=False)
        return response


class CurrentUserView(APIView):
    """
    Retrieves currently authenticated user, identity, role, and permissions.
    Returns 401 if unauthenticated.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        role, permissions = get_user_role_and_permissions(user)

        student_data = None
        if hasattr(user, 'student_profile'):
            student_data = StudentProfileDetailSerializer(user.student_profile).data

        return Response({
            'authenticated': True,
            'user': UserSerializer(user).data,
            'student': student_data,
            'role': role,
            'permissions': permissions,
        })


class StudentProfileUpdateView(APIView):
    """
    Updates student profile details (Name, Degree, Branch, Semester, CGPA).
    Protected: Only authenticated students can update their profile.
    """
    permission_classes = [IsAuthenticated, IsStudentUser]

    def put(self, request):
        user = request.user
        if not hasattr(user, 'student_profile'):
            return Response({'error': 'StudentProfileNotFound', 'detail': 'No student profile linked to this user.'}, status=status.HTTP_404_NOT_FOUND)

        student = user.student_profile
        serializer = StudentUpdateProfileSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        if 'name' in data and data['name']:
            parts = data['name'].strip().split()
            student.user.first_name = parts[0]
            student.user.last_name = " ".join(parts[1:]) if len(parts) > 1 else ''
            student.user.save()

        if 'degree' in data and data['degree']:
            student.degree = data['degree'].strip()
        if 'branch' in data and data['branch']:
            student.branch = data['branch'].strip()
            student.major = data['branch'].strip()
        if 'semester' in data and data['semester'] is not None:
            student.semester = int(data['semester'])
            if student.semester in [5, 6]:
                student.academic_year = 'Junior'
            elif student.semester in [3, 4]:
                student.academic_year = 'Sophomore'
            elif student.semester >= 7:
                student.academic_year = 'Senior'
            else:
                student.academic_year = 'Freshman'

        if 'cgpa' in data and data['cgpa'] is not None:
            student.cgpa = float(data['cgpa'])

        student.profile_completed = True
        student.save()

        return Response({
            'status': 'success',
            'message': 'Profile updated successfully.',
            'student': StudentProfileDetailSerializer(student).data,
        })


class LogoutView(APIView):
    """
    Terminates the user session.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        response = Response({'status': 'success', 'message': 'Successfully logged out.'})
        response.delete_cookie('access_token')
        response.delete_cookie('sessionid')
        return response
