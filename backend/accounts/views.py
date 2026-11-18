import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import authenticate, login, logout
from django.utils.text import slugify
from .models import User, Student, Cohort
from .permissions import IsFacultyUser, IsStudentUser
from .serializers import (
    UserSerializer,
    StudentProfileDetailSerializer,
    CustomTokenObtainPairSerializer,
    StudentLoginSerializer,
    StudentRegisterSerializer,
    FacultyLoginSerializer,
    StudentUpdateProfileSerializer,
    get_user_role_and_permissions,
)

logger = logging.getLogger(__name__)


class LoginView(TokenObtainPairView):
    """
    Dedicated JWT Login: Authenticates faculty or students via username, email,
    or student registration number and password. Returns access and refresh JWT tokens
    with identity, role (STUDENT vs FACULTY), and permissions payload.
    """
    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


class StudentLoginView(APIView):
    """
    Dedicated Student Login: Authenticates students using Registration Number and Password (or Email).
    Returns JWT tokens with identity, role ('STUDENT'), and permissions.
    """
    permission_classes = [AllowAny]

    def post(self, request):
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

        refresh = CustomTokenObtainPairSerializer.get_token(user)
        role, permissions = get_user_role_and_permissions(user)

        return Response({
            'status': 'success',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'message': f"Welcome back, {user.get_full_name() or user.username}!",
            'user': UserSerializer(user).data,
            'student': StudentProfileDetailSerializer(student).data,
            'role': role,
            'permissions': permissions,
        }, status=status.HTTP_200_OK)


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
            role=User.Role.STUDENT
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

        refresh = CustomTokenObtainPairSerializer.get_token(user)
        role, permissions = get_user_role_and_permissions(user)

        return Response({
            'status': 'success',
            'message': f"Student account created successfully for {name} ({reg_no}).",
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
            'student': StudentProfileDetailSerializer(student).data,
            'role': role,
            'permissions': permissions,
        }, status=status.HTTP_201_CREATED)


class FacultyLoginView(APIView):
    """
    Dedicated Faculty Login: Authenticates instructors and admins via credentials.
    Returns JWT tokens with identity, role ('FACULTY'), and permissions.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = FacultyLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data['user']
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        role, permissions = get_user_role_and_permissions(user)

        return Response({
            'status': 'success',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'message': f"Welcome, {user.get_full_name() or user.username}!",
            'user': UserSerializer(user).data,
            'role': user.role if user.role == 'INSTRUCTOR' else role,
            'permissions': permissions,
        }, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    """
    Retrieves currently authenticated JWT user, identity, role, and permissions.
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
        return Response({'status': 'success', 'message': 'Successfully logged out.'})
