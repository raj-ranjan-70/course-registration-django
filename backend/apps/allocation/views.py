import logging
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from accounts.models import Student
from accounts.permissions import IsFacultyUser, IsStudentUser
from courses.views import resolve_student
from courses.models import Course
from .models import ElectivePreference, AllocationRun, AllocationResult
from .serializers import (
    ElectivePreferenceSerializer,
    BulkPreferenceSubmitSerializer,
    AllocationRunSerializer,
    AllocationResultSerializer,
    RunAllocationRequestSerializer,
)
from .services import execute_allocation_run

logger = logging.getLogger(__name__)


class ElectivePreferenceViewSet(viewsets.ModelViewSet):
    """
    API endpoint for students to submit, reorder, review, and view history of ranked elective choices.
    """
    serializer_class = ElectivePreferenceSerializer
    permission_classes = [IsAuthenticated, IsStudentUser]

    def get_queryset(self):
        student = resolve_student(self.request)
        term = self.request.query_params.get('term', 'Fall 2026')
        return (
            ElectivePreference.objects.filter(student=student, term=term)
            .select_related('course', 'student', 'student__user')
            .order_by('preference_rank')
        )

    @action(detail=False, methods=['get'])
    def me(self, request):
        """
        GET /api/preferences/me/
        Returns the requesting student's current elective preferences and recent allocation result.
        Automatically executes the matching algorithm and publishes results when the deadline expires.
        """
        student = resolve_student(request)
        term = request.query_params.get('term', 'Fall 2026')
        preferences = (
            ElectivePreference.objects.filter(student=student, term=term)
            .select_related('course', 'student', 'student__user')
            .order_by('preference_rank')
        )
        serializer = ElectivePreferenceSerializer(preferences, many=True)

        from courses.models import ElectiveGroup
        elective = ElectiveGroup.objects.filter(term=term, is_draft=False).first()

        # If deadline has passed and results not yet published, run matching algorithm automatically
        if elective and elective.is_deadline_passed and not elective.is_published:
            from .services import execute_allocation_run
            try:
                execute_allocation_run(term=term, seed=f"auto-{elective.id}")
                elective.is_published = True
                elective.results_published_at = timezone.now()
                elective.save(update_fields=['is_published', 'results_published_at'])
            except Exception as e:
                logger.error("Auto allocation on deadline expiry: %s", e)

        # Check if results are published or deadline has elapsed
        is_published = elective.is_published if elective else True

        result_data = None
        if is_published:
            latest_result = (
                AllocationResult.objects.filter(student=student, allocation_run__term=term)
                .select_related('course', 'allocation_run')
                .order_by('-created_at')
                .first()
            )
            result_data = AllocationResultSerializer(latest_result).data if latest_result else None

        return Response({
            'term': term,
            'student_id': student.student_id,
            'preferences': serializer.data,
            'allocation_result': result_data,
            'is_published': is_published,
        })

    @action(detail=False, methods=['get'])
    def history(self, request):
        """
        GET /api/preferences/history/
        Returns comprehensive historical audit view: past preferences submitted and all allocation run results.
        """
        student = resolve_student(request)

        # All submitted preferences
        past_preferences = (
            ElectivePreference.objects.filter(student=student)
            .select_related('course')
            .order_by('-submitted_at', 'preference_rank')
        )

        # All allocation run results for this student
        allocation_results = (
            AllocationResult.objects.filter(student=student)
            .select_related('course', 'assigned_section', 'allocation_run')
            .order_by('-created_at')
        )

        return Response({
            'student_id': student.student_id,
            'student_name': student.user.get_full_name() or student.user.username,
            'preferences_history': ElectivePreferenceSerializer(past_preferences, many=True).data,
            'allocations_history': AllocationResultSerializer(allocation_results, many=True).data,
        })

    def create(self, request, *args, **kwargs):
        """
        POST /api/preferences/
        Submits ranked elective preferences with deadline enforcement and max choice checks.
        """
        student = resolve_student(request)
        term = request.data.get('term', 'Fall 2026')
        now = timezone.now()

        # Check for bulk course_ids list
        if 'course_ids' in request.data:
            serializer = BulkPreferenceSubmitSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            course_ids = serializer.validated_data['course_ids']
            if len(course_ids) != len(set(course_ids)):
                return Response(
                    {'error': 'DuplicateCourseError', 'detail': 'Cannot submit duplicate courses in preference list.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate max choices allowed (e.g. 5)
            max_allowed = 5
            if len(course_ids) > max_allowed:
                return Response(
                    {
                        'error': 'MaxChoicesExceeded',
                        'detail': f"You may only submit up to {max_allowed} elective choices (submitted: {len(course_ids)}).",
                        'code': 'MAX_CHOICES_EXCEEDED',
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate that all course_ids exist and are active
            courses = list(Course.objects.filter(id__in=course_ids, is_active=True))
            existing_ids = {c.id for c in courses}
            missing_ids = set(course_ids) - existing_ids
            if missing_ids:
                return Response(
                    {'error': 'InvalidCourseError', 'detail': f"Courses not found: {list(missing_ids)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Enforce Faculty Deadlines: Check if submission deadline has passed for any chosen course
            for course in courses:
                if course.submission_deadline and now > course.submission_deadline:
                    deadline_str = course.submission_deadline.strftime('%b %d, %Y at %I:%M %p')
                    return Response(
                        {
                            'error': 'DeadlinePassedError',
                            'detail': f"Preference modification locked: Registration deadline for {course.code} ({course.title}) passed on {deadline_str}.",
                            'code': 'DEADLINE_PASSED',
                        },
                        status=status.HTTP_403_FORBIDDEN
                    )

            with transaction.atomic():
                # Replace existing preferences for this student in this term
                ElectivePreference.objects.filter(student=student, term=term).delete()

                prefs_to_create = [
                    ElectivePreference(
                        student=student,
                        course_id=cid,
                        preference_rank=idx + 1,
                        term=term,
                    )
                    for idx, cid in enumerate(course_ids)
                ]
                ElectivePreference.objects.bulk_create(prefs_to_create)

            updated = (
                ElectivePreference.objects.filter(student=student, term=term)
                .select_related('course', 'student', 'student__user')
                .order_by('preference_rank')
            )
            return Response(
                {
                    'status': 'success',
                    'message': f"Saved {len(prefs_to_create)} ranked elective preferences.",
                    'preferences': ElectivePreferenceSerializer(updated, many=True).data,
                },
                status=status.HTTP_201_CREATED
            )

        # Single preference creation
        course_id = request.data.get('course_id')
        rank = request.data.get('preference_rank')
        if not course_id or not rank:
            return Response(
                {'error': 'MissingFields', 'detail': 'Both course_id and preference_rank are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        course = Course.objects.filter(id=course_id, is_active=True).first()
        if not course:
            return Response({'error': 'CourseNotFound', 'detail': 'Course not found.'}, status=status.HTTP_404_NOT_FOUND)

        if course.submission_deadline and now > course.submission_deadline:
            deadline_str = course.submission_deadline.strftime('%b %d, %Y at %I:%M %p')
            return Response(
                {
                    'error': 'DeadlinePassedError',
                    'detail': f"Preference modification locked: Registration deadline for {course.code} passed on {deadline_str}.",
                    'code': 'DEADLINE_PASSED',
                },
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            pref, created = ElectivePreference.objects.update_or_create(
                student=student,
                course_id=course_id,
                term=term,
                defaults={'preference_rank': int(rank)}
            )

        return Response(ElectivePreferenceSerializer(pref).data, status=status.HTTP_201_CREATED)


class AllocationRunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Administrator endpoint to execute batch matching, inspect audit logs, and view run results.
    """
    queryset = AllocationRun.objects.all().prefetch_related('results__student__user', 'results__course')
    serializer_class = AllocationRunSerializer
    permission_classes = [IsAuthenticated, IsFacultyUser]

    @action(detail=False, methods=['post'], url_path='run')
    def run_allocation(self, request):
        """
        POST /api/allocations/run/
        Executes Deferred Acceptance batch matching with deterministic SHA-256 tiebreaker.
        """
        serializer = RunAllocationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        term = serializer.validated_data.get('term', 'Fall 2026')
        seed = serializer.validated_data.get('seed')
        apply_enrollment = serializer.validated_data.get('apply_enrollment', False)

        try:
            run = execute_allocation_run(
                term=term,
                seed=seed,
                apply_enrollment=apply_enrollment,
            )
            run_data = AllocationRunSerializer(run).data
            return Response(
                {
                    'status': 'success',
                    'message': f"Allocation run #{run.id} completed successfully.",
                    'run': run_data,
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            logger.exception("Allocation run execution failed: %s", e)
            return Response(
                {'error': 'AllocationError', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
