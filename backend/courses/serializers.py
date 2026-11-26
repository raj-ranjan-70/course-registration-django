from rest_framework import serializers
from .models import (
    ElectiveGroup,
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
from accounts.models import Student, Cohort


class ClassScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassSchedule
        fields = [
            'id',
            'day',
            'start_time',
            'end_time',
            'location',
        ]


class PrerequisiteSerializer(serializers.ModelSerializer):
    prerequisite_course_code = serializers.CharField(source='prerequisite_course.code', read_only=True)
    prerequisite_course_title = serializers.CharField(source='prerequisite_course.title', read_only=True)

    class Meta:
        model = Prerequisite
        fields = [
            'id',
            'prerequisite_course',
            'prerequisite_course_code',
            'prerequisite_course_title',
            'min_grade',
            'is_mandatory',
        ]


class SectionSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_department = serializers.CharField(source='course.department', read_only=True)
    course_credits = serializers.IntegerField(source='course.credits', read_only=True)
    available_seats = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    schedules = ClassScheduleSerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = [
            'id',
            'course',
            'course_code',
            'course_title',
            'course_department',
            'course_credits',
            'section_number',
            'term',
            'instructor_name',
            'schedule',
            'classroom',
            'capacity',
            'enrolled_count',
            'available_seats',
            'is_full',
            'status',
            'schedules',
            'created_at',
            'updated_at',
        ]


class CourseSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)
    prerequisites = PrerequisiteSerializer(many=True, read_only=True)
    total_sections = serializers.SerializerMethodField()
    instructor_name = serializers.SerializerMethodField()
    is_submission_open = serializers.BooleanField(read_only=True)
    capacity = serializers.IntegerField(write_only=True, required=False, default=30)

    class Meta:
        model = Course
        fields = [
            'id',
            'code',
            'title',
            'description',
            'department',
            'credits',
            'is_active',
            'category',
            'target_degrees',
            'target_branches',
            'min_cgpa',
            'allowed_semesters',
            'max_preferences',
            'submission_deadline',
            'is_submission_open',
            'instructor',
            'instructor_name',
            'capacity',
            'prerequisites',
            'sections',
            'total_sections',
            'created_at',
            'updated_at',
        ]

    def get_total_sections(self, obj) -> int:
        return obj.sections.count()

    def get_instructor_name(self, obj) -> str:
        if obj.instructor:
            return obj.instructor.get_full_name() or obj.instructor.username
        # Check first section instructor if assigned
        first_sec = obj.sections.first()
        return first_sec.instructor_name if first_sec else "Faculty Instructor"


class RegistrationWindowSerializer(serializers.ModelSerializer):
    cohort_name = serializers.CharField(source='cohort.name', read_only=True)
    cohort_code = serializers.CharField(source='cohort.code', read_only=True)
    is_currently_open = serializers.BooleanField(read_only=True)
    current_state = serializers.CharField(read_only=True)

    class Meta:
        model = RegistrationWindow
        fields = [
            'id',
            'cohort',
            'cohort_name',
            'cohort_code',
            'term',
            'start_time',
            'end_time',
            'status',
            'current_state',
            'is_currently_open',
        ]


class StudentCourseHistorySerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)

    class Meta:
        model = StudentCourseHistory
        fields = [
            'id',
            'course',
            'course_code',
            'course_title',
            'grade',
            'passed',
            'term_completed',
        ]


class RegistrationSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_name = serializers.SerializerMethodField()
    section = SectionSerializer(read_only=True)

    class Meta:
        model = Registration
        fields = [
            'id',
            'student_id',
            'student_name',
            'section',
            'status',
            'idempotency_key',
            'registered_at',
            'updated_at',
        ]

    def get_student_name(self, obj) -> str:
        return obj.student.user.get_full_name() or obj.student.user.username


class CartItemSerializer(serializers.ModelSerializer):
    section = SectionSerializer(read_only=True)

    class Meta:
        model = CartItem
        fields = [
            'id',
            'section',
            'added_at',
        ]


class EligibilitySnapshotSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)

    class Meta:
        model = EligibilitySnapshot
        fields = [
            'id',
            'student',
            'course',
            'course_code',
            'course_title',
            'eligible',
            'reasons',
            'section_eligibility',
            'updated_at',
        ]


class RegisterRequestSerializer(serializers.Serializer):
    section_id = serializers.IntegerField(required=True)
    idempotency_key = serializers.CharField(required=False, allow_blank=True, max_length=128)
    student_id = serializers.CharField(required=False, allow_blank=True)


class StudentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email', read_only=True)
    cohort_name = serializers.CharField(source='cohort.name', read_only=True)
    cohort_code = serializers.CharField(source='cohort.code', read_only=True)
    total_enrolled_credits = serializers.IntegerField(read_only=True)
    active_registrations = serializers.SerializerMethodField()
    completed_courses = StudentCourseHistorySerializer(many=True, read_only=True)
    registration_window = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id',
            'student_id',
            'username',
            'name',
            'email',
            'cohort',
            'cohort_name',
            'cohort_code',
            'major',
            'degree',
            'branch',
            'semester',
            'cgpa',
            'academic_year',
            'max_credits',
            'profile_completed',
            'total_enrolled_credits',
            'active_registrations',
            'completed_courses',
            'registration_window',
        ]

    def get_name(self, obj) -> str:
        return obj.user.get_full_name() or obj.user.username

    def get_active_registrations(self, obj):
        regs = obj.registrations.filter(status=Registration.Status.REGISTERED).select_related('section', 'section__course')
        return RegistrationSerializer(regs, many=True).data

    def get_registration_window(self, obj):
        if not obj.cohort:
            return None
        window = obj.cohort.registration_windows.filter(term='Fall 2026').first()
        if window:
            return RegistrationWindowSerializer(window).data
        return None


class CourseInElectiveSerializer(serializers.ModelSerializer):
    enrolled_count = serializers.SerializerMethodField()
    available_seats = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id',
            'code',
            'title',
            'credits',
            'capacity',
            'min_cgpa',
            'enrolled_count',
            'available_seats',
        ]

    def get_enrolled_count(self, obj) -> int:
        sec = obj.sections.first()
        return sec.enrolled_count if sec else 0

    def get_available_seats(self, obj) -> int:
        sec = obj.sections.first()
        return sec.available_seats if sec else obj.capacity


class CourseItemCreateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=20)
    title = serializers.CharField(max_length=255)
    credits = serializers.IntegerField(default=3, min_value=1, max_value=12)
    capacity = serializers.IntegerField(default=30, min_value=1)
    min_cgpa = serializers.FloatField(required=False, allow_null=True, min_value=0.0, max_value=10.0)


class ElectiveGroupSerializer(serializers.ModelSerializer):
    courses = CourseInElectiveSerializer(many=True, read_only=True)
    instructor_name = serializers.SerializerMethodField()
    is_deadline_passed = serializers.BooleanField(read_only=True)
    total_courses = serializers.SerializerMethodField()
    total_seats = serializers.SerializerMethodField()

    class Meta:
        model = ElectiveGroup
        fields = [
            'id',
            'title',
            'description',
            'department',
            'term',
            'submission_deadline',
            'is_draft',
            'current_step',
            'is_published',
            'results_published_at',
            'is_deadline_passed',
            'min_cgpa',
            'allowed_semesters',
            'target_degrees',
            'target_branches',
            'max_preferences',
            'allow_preference_editing',
            'instructor',
            'instructor_name',
            'courses',
            'total_courses',
            'total_seats',
            'created_at',
            'updated_at',
        ]

    def get_instructor_name(self, obj) -> str:
        if obj.instructor:
            return obj.instructor.get_full_name() or obj.instructor.username
        return "Faculty Instructor"

    def get_total_courses(self, obj) -> int:
        return obj.courses.count()

    def get_total_seats(self, obj) -> int:
        return sum(c.capacity for c in obj.courses.all())


class ElectiveStep1Serializer(serializers.Serializer):
    """Step 1: Title, Description, Submission Deadline (Required), Academic Term, Department."""
    draft_id = serializers.IntegerField(required=False, allow_null=True)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    submission_deadline = serializers.DateTimeField(required=True)
    term = serializers.CharField(required=False, default='Fall 2026')
    department = serializers.CharField(required=False, allow_blank=True, default='Computer Science')
    allow_preference_editing = serializers.BooleanField(required=False, default=True)


class ElectiveStep2Serializer(serializers.Serializer):
    """Step 2: Dynamic Course List (at least 2 courses) with Course Code, Course Name, Credits, individual Seats & Min CGPA."""
    courses = CourseItemCreateSerializer(many=True, required=True)

    def validate_courses(self, value):
        if len(value) < 2:
            raise serializers.ValidationError("At least 2 courses must be added to this elective.")
        for idx, course in enumerate(value, start=1):
            if not course.get('code', '').strip():
                raise serializers.ValidationError(f"Course #{idx} must have a valid course code.")
            if not course.get('title', '').strip():
                raise serializers.ValidationError(f"Course #{idx} must have a valid course name.")
            if not course.get('capacity') or course['capacity'] <= 0:
                raise serializers.ValidationError(f"Course #{idx} must have a seat capacity greater than 0.")
        return value


class ElectiveStep3Serializer(serializers.Serializer):
    """Step 3: Whole-Elective Criteria (Overall Min CGPA, Allowed Semesters, Target Degrees, Target Branches)."""
    min_cgpa = serializers.FloatField(required=False, allow_null=True, min_value=0.0, max_value=10.0)
    allowed_semesters = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    target_degrees = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    target_branches = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    max_preferences = serializers.IntegerField(required=False, default=5)
    allow_preference_editing = serializers.BooleanField(required=False, default=True)
    finalize = serializers.BooleanField(required=False, default=False)


class ElectiveGroupCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    department = serializers.CharField(required=False, default='Computer Science')
    term = serializers.CharField(required=False, default='Fall 2026')
    submission_deadline = serializers.DateTimeField(required=True)  # Required!
    min_cgpa = serializers.FloatField(required=False, allow_null=True, min_value=0.0, max_value=10.0)
    allowed_semesters = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    target_degrees = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    target_branches = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    max_preferences = serializers.IntegerField(required=False, default=5)
    allow_preference_editing = serializers.BooleanField(required=False, default=True)
    courses = CourseItemCreateSerializer(many=True, required=True)

