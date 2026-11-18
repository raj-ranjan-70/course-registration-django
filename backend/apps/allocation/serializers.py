from rest_framework import serializers
from .models import ElectivePreference, AllocationRun, AllocationResult
from courses.serializers import CourseSerializer


class ElectivePreferenceSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_name = serializers.SerializerMethodField()
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_department = serializers.CharField(source='course.department', read_only=True)
    course_credits = serializers.IntegerField(source='course.credits', read_only=True)

    class Meta:
        model = ElectivePreference
        fields = [
            'id',
            'student_id',
            'student_name',
            'course',
            'course_code',
            'course_title',
            'course_department',
            'course_credits',
            'preference_rank',
            'term',
            'submitted_at',
        ]

    def get_student_name(self, obj) -> str:
        return obj.student.user.get_full_name() or obj.student.user.username


class BulkPreferenceSubmitSerializer(serializers.Serializer):
    course_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        help_text="Ordered list of course IDs where index 0 is Rank 1, index 1 is Rank 2, etc."
    )
    term = serializers.CharField(default='Fall 2026', required=False)
    student_id = serializers.CharField(required=False, allow_blank=True)


class AllocationResultSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    student_name = serializers.SerializerMethodField()
    student_cohort = serializers.CharField(source='student.cohort.name', default='', read_only=True)
    student_major = serializers.CharField(source='student.major', read_only=True)
    student_cgpa = serializers.FloatField(source='student.cgpa', read_only=True)
    course_code = serializers.CharField(source='course.code', default=None, read_only=True)
    course_title = serializers.CharField(source='course.title', default=None, read_only=True)

    class Meta:
        model = AllocationResult
        fields = [
            'id',
            'student_id',
            'student_name',
            'student_cohort',
            'student_major',
            'student_cgpa',
            'course',
            'course_code',
            'course_title',
            'assigned_section',
            'matched',
            'preference_rank',
            'priority_score',
            'tiebreaker_value',
            'audit_details',
            'created_at',
        ]

    def get_student_name(self, obj) -> str:
        return obj.student.user.get_full_name() or obj.student.user.username


class AllocationRunSerializer(serializers.ModelSerializer):
    results = AllocationResultSerializer(many=True, read_only=True)

    class Meta:
        model = AllocationRun
        fields = [
            'id',
            'term',
            'seed',
            'status',
            'algorithm',
            'config',
            'total_students',
            'total_courses',
            'total_matched',
            'total_unmatched',
            'satisfaction_rate',
            'rank_distribution',
            'execution_time_ms',
            'created_at',
            'completed_at',
            'results',
        ]


class RunAllocationRequestSerializer(serializers.Serializer):
    term = serializers.CharField(default='Fall 2026', required=False)
    seed = serializers.CharField(required=False, allow_blank=True)
    apply_enrollment = serializers.BooleanField(default=False, required=False)
