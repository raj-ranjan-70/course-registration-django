from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User, Student, Cohort


def get_user_role_and_permissions(user):
    role = 'FACULTY' if user.is_faculty else 'STUDENT'
    if role == 'FACULTY':
        permissions = [
            'can_manage_electives',
            'can_run_allocation',
            'can_view_analytics',
        ]
    else:
        permissions = [
            'can_submit_preferences',
            'can_view_results',
            'can_edit_profile',
        ]
    return role, permissions


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'profile_completed',
            'auth_provider',
            'provider_id',
        ]


class CompleteProfileSerializer(serializers.Serializer):
    name = serializers.CharField(required=True)
    registration_number = serializers.CharField(required=True)
    degree = serializers.CharField(required=False, default='B.Tech')
    branch = serializers.CharField(required=False, default='CSE')
    semester = serializers.IntegerField(required=False, default=5, min_value=1, max_value=10)
    cgpa = serializers.FloatField(required=False, default=8.0, min_value=0.0, max_value=10.0)


class StudentProfileDetailSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email', read_only=True)
    cohort_name = serializers.CharField(source='cohort.name', read_only=True)
    cohort_code = serializers.CharField(source='cohort.code', read_only=True)
    total_enrolled_credits = serializers.IntegerField(read_only=True)

    class Meta:
        model = Student
        fields = [
            'id',
            'student_id',
            'username',
            'first_name',
            'last_name',
            'name',
            'email',
            'degree',
            'branch',
            'semester',
            'cgpa',
            'major',
            'academic_year',
            'max_credits',
            'total_enrolled_credits',
            'profile_completed',
            'cohort',
            'cohort_name',
            'cohort_code',
        ]

    def get_name(self, obj) -> str:
        return obj.user.get_full_name() or obj.user.username


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'username'

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        role, permissions = get_user_role_and_permissions(user)

        token['user_id'] = user.id
        token['username'] = user.username
        token['email'] = user.email
        token['role'] = role
        token['permissions'] = permissions

        if hasattr(user, 'student_profile'):
            token['student_id'] = user.student_profile.student_id
            token['name'] = user.get_full_name() or user.username
        else:
            token['name'] = user.get_full_name() or user.username

        return token

    def validate(self, attrs):
        identifier = attrs.get('username') or self.initial_data.get('identifier') or self.initial_data.get('email')
        password = attrs.get('password')

        user = None
        if identifier and password:
            clean_id = identifier.strip()
            # 1. Try username
            user = authenticate(username=clean_id, password=password)
            # 2. Try email
            if not user:
                matched_user = User.objects.filter(email__iexact=clean_id).first()
                if matched_user:
                    user = authenticate(username=matched_user.username, password=password)
            # 3. Try student registration number
            if not user:
                student = Student.objects.filter(student_id__iexact=clean_id).select_related('user').first()
                if student:
                    user = authenticate(username=student.user.username, password=password)

        if not user:
            raise serializers.ValidationError({'detail': 'Invalid credentials. Please verify your email/registration number and password.'})

        if not user.is_active:
            raise serializers.ValidationError({'detail': 'This account has been deactivated.'})

        refresh = self.get_token(user)
        role, permissions = get_user_role_and_permissions(user)

        student_data = None
        if hasattr(user, 'student_profile'):
            student_data = StudentProfileDetailSerializer(user.student_profile).data

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data,
            'role': role,
            'permissions': permissions,
            'student': student_data,
        }


class UnifiedLoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class StudentLoginSerializer(serializers.Serializer):
    registration_number = serializers.CharField(required=True)
    password = serializers.CharField(required=False, write_only=True)
    email = serializers.EmailField(required=False)


class StudentRegisterSerializer(serializers.Serializer):
    registration_number = serializers.CharField(required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=False, default='Password@123', write_only=True)
    name = serializers.CharField(required=True)
    degree = serializers.CharField(required=False, default='B.Tech')
    branch = serializers.CharField(required=False, default='CSE')
    semester = serializers.IntegerField(required=False, default=5, min_value=1, max_value=10)
    cgpa = serializers.FloatField(required=False, default=8.0, min_value=0.0, max_value=10.0)


class StudentUpdateProfileSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    degree = serializers.CharField(required=False)
    branch = serializers.CharField(required=False)
    semester = serializers.IntegerField(required=False, min_value=1, max_value=10)
    cgpa = serializers.FloatField(required=False, min_value=0.0, max_value=10.0)


class FacultyLoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        user = authenticate(username=username, password=password)
        if not user:
            # Check by email as well
            matched_user = User.objects.filter(email__iexact=username).first()
            if matched_user:
                user = authenticate(username=matched_user.username, password=password)

        if not user:
            raise serializers.ValidationError('Invalid username/email or password.')
        if not user.is_faculty:
            raise serializers.ValidationError('Access denied. Faculty or Admin privileges required.')
        attrs['user'] = user
        return attrs
