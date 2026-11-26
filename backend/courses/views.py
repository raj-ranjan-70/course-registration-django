import logging
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from accounts.models import Student, User, Cohort
from accounts.permissions import IsFacultyUser, IsStudentUser
from django.db import transaction
from django.utils import timezone
from .models import (
    ElectiveGroup,
    Course,
    Section,
    Registration,
    CartItem,
    EligibilitySnapshot,
    RegistrationWindow,
)
from .serializers import (
    CourseSerializer,
    SectionSerializer,
    RegistrationSerializer,
    RegisterRequestSerializer,
    StudentSerializer,
    CartItemSerializer,
    EligibilitySnapshotSerializer,
    RegistrationWindowSerializer,
    ElectiveGroupSerializer,
    ElectiveGroupCreateSerializer,
    ElectiveStep1Serializer,
    ElectiveStep2Serializer,
    ElectiveStep3Serializer,
)
from .services import (
    claim_seat_and_register,
    drop_registration,
    add_section_to_cart,
    SectionNotFoundError,
    SectionFullError,
    RegistrationClosedError,
    CourseConflictError,
    CreditLimitExceededError,
    RegistrationError,
)
from .eligibility import (
    RegistrationWindowForbiddenError,
    PrerequisiteNotMetError,
    TimetableClashError,
    evaluate_course_eligibility,
    precompute_all_snapshots_for_student,
)

logger = logging.getLogger(__name__)


def resolve_student(request) -> Student:
    """
    Resolves the requesting student strictly from authenticated user.
    """
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        if hasattr(user, 'student_profile'):
            return user.student_profile
        if getattr(user, 'is_faculty', False) or user.is_staff:
            student_id = (
                request.headers.get('X-Student-Id')
                or request.query_params.get('student_id')
                or (request.data.get('student_id') if isinstance(request.data, dict) else None)
            )
            if student_id:
                s = Student.objects.filter(student_id=student_id).first()
                if s:
                    return s
        raise PermissionDenied("Student account required for this operation.")
    raise PermissionDenied("Authentication credentials were not provided.")


class ElectiveGroupViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing Elective Groups (Baskets) containing multiple courses.
    Allows faculty to define title, short description, required deadline, whole-elective criteria,
    and a list of individual courses with individual seat capacities and cutoffs.
    Supports step-by-step drafting and draft restoration.
    """
    queryset = ElectiveGroup.objects.prefetch_related('courses__sections').all()
    serializer_class = ElectiveGroupSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'publish', 'save_step_1', 'save_step_2', 'save_step_3']:
            return [IsFacultyUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = ElectiveGroup.objects.prefetch_related('courses__sections').all()
        if not getattr(user, 'is_faculty', False):
            # Students only see active, finalized electives matching their semester
            qs = qs.filter(is_draft=False)
            student = getattr(user, 'student_profile', None)
            if student and student.semester is not None:
                eligible_ids = [
                    el.id for el in qs
                    if not el.allowed_semesters or student.semester in el.allowed_semesters
                ]
                return qs.filter(id__in=eligible_ids)
            return qs

        # Faculty can filter by draft status: ?is_draft=true or ?is_draft=false
        is_draft_param = self.request.query_params.get('is_draft')
        if is_draft_param is not None:
            if is_draft_param.lower() in ['true', '1']:
                return qs.filter(is_draft=True)
            elif is_draft_param.lower() in ['false', '0']:
                return qs.filter(is_draft=False)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = ElectiveGroupCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        courses_data = data.pop('courses')
        if not courses_data:
            return Response({'error': 'At least one course must be included in the elective.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if getattr(request.user, 'is_faculty', False) else None

        with transaction.atomic():
            elective = ElectiveGroup.objects.create(
                instructor=user,
                is_draft=False,
                current_step=3,
                **data
            )

            # Create courses in this elective
            for c_data in courses_data:
                course_code = c_data['code'].strip().upper()
                capacity = c_data.get('capacity', 30)
                course_min_cgpa = c_data.get('min_cgpa') or elective.min_cgpa

                course = Course.objects.create(
                    elective_group=elective,
                    code=course_code,
                    title=c_data['title'].strip(),
                    credits=c_data.get('credits', 3),
                    capacity=capacity,
                    min_cgpa=course_min_cgpa,
                    department=elective.department or 'Computer Science',
                    submission_deadline=elective.submission_deadline,
                    allowed_semesters=elective.allowed_semesters,
                    target_degrees=elective.target_degrees,
                    target_branches=elective.target_branches,
                    max_preferences=elective.max_preferences,
                    instructor=user,
                )

                # Default section with specified capacity
                Section.objects.create(
                    course=course,
                    section_number='01',
                    term=elective.term,
                    capacity=capacity,
                    instructor_name=(user.get_full_name() or user.username) if user else "Faculty Instructor",
                    status=Section.Status.OPEN,
                )

        return Response(ElectiveGroupSerializer(elective).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='save-step-1')
    def save_step_1(self, request):
        """Step 1: Save basic details (Title, Description, Required Deadline, Academic Term)."""
        serializer = ElectiveStep1Serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        draft_id = data.pop('draft_id', None)
        user = request.user if getattr(request.user, 'is_faculty', False) else None

        if draft_id:
            try:
                elective = ElectiveGroup.objects.get(pk=draft_id)
                for field, val in data.items():
                    setattr(elective, field, val)
                elective.current_step = max(elective.current_step, 1)
                elective.save()
            except ElectiveGroup.DoesNotExist:
                return Response({'error': 'Draft not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            elective = ElectiveGroup.objects.create(
                instructor=user,
                is_draft=True,
                current_step=1,
                **data
            )

        return Response(ElectiveGroupSerializer(elective).data, status=status.HTTP_200_OK if draft_id else status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='save-step-2')
    def save_step_2(self, request, pk=None):
        """Step 2: Save dynamic list of courses (at least 2 courses) with individual seats and min CGPA."""
        elective = self.get_object()
        serializer = ElectiveStep2Serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        courses_data = serializer.validated_data['courses']
        user = request.user if getattr(request.user, 'is_faculty', False) else elective.instructor

        with transaction.atomic():
            # Cleanly replace draft courses for this elective
            elective.courses.all().delete()

            for c_data in courses_data:
                course_code = c_data['code'].strip().upper()
                capacity = c_data.get('capacity', 30)
                course_min_cgpa = c_data.get('min_cgpa') or elective.min_cgpa

                course = Course.objects.create(
                    elective_group=elective,
                    code=course_code,
                    title=c_data['title'].strip(),
                    credits=c_data.get('credits', 3),
                    capacity=capacity,
                    min_cgpa=course_min_cgpa,
                    department=elective.department or 'Computer Science',
                    submission_deadline=elective.submission_deadline,
                    allowed_semesters=elective.allowed_semesters,
                    target_degrees=elective.target_degrees,
                    target_branches=elective.target_branches,
                    max_preferences=elective.max_preferences,
                    instructor=user,
                )

                Section.objects.create(
                    course=course,
                    section_number='01',
                    term=elective.term,
                    capacity=capacity,
                    instructor_name=(user.get_full_name() or user.username) if user else "Faculty Instructor",
                    status=Section.Status.OPEN,
                )

            elective.current_step = max(elective.current_step, 2)
            elective.save(update_fields=['current_step'])

        return Response(ElectiveGroupSerializer(elective).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='save-step-3')
    def save_step_3(self, request, pk=None):
        """Step 3: Save whole-elective criteria (CGPA, Semesters, Degrees, Branches) and optionally finalize."""
        elective = self.get_object()
        serializer = ElectiveStep3Serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        finalize = data.pop('finalize', False)

        for field, val in data.items():
            setattr(elective, field, val)

        elective.current_step = 3
        if finalize:
            if elective.courses.count() < 2:
                return Response(
                    {'error': 'An elective must contain at least 2 courses before being finalized.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not elective.submission_deadline:
                return Response(
                    {'error': 'A valid submission deadline is required.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            elective.is_draft = False

        elective.save()

        # Sync elective-level criteria down to its courses
        elective.courses.update(
            allowed_semesters=elective.allowed_semesters,
            target_degrees=elective.target_degrees,
            target_branches=elective.target_branches,
            max_preferences=elective.max_preferences,
            submission_deadline=elective.submission_deadline,
        )

        return Response(ElectiveGroupSerializer(elective).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """
        Publishes elective results. Automatically executes the Gale-Shapley matching algorithm
        before publishing.
        """
        elective = self.get_object()
        term = elective.term

        from apps.allocation.services import execute_allocation_run
        from apps.allocation.serializers import AllocationRunSerializer

        try:
            run = execute_allocation_run(
                term=term,
                seed=f"auto-{elective.id}-{int(timezone.now().timestamp())}",
                apply_enrollment=True,
            )
            elective.is_published = True
            elective.results_published_at = timezone.now()
            elective.save(update_fields=['is_published', 'results_published_at'])

            return Response({
                'status': 'success',
                'message': f"Matching algorithm automatically executed and results published for '{elective.title}'.",
                'elective': ElectiveGroupSerializer(elective).data,
                'allocation_run': AllocationRunSerializer(run).data,
            })
        except Exception as e:
            logger.exception("Failed to execute allocation before publishing: %s", e)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CourseViewSet(viewsets.ModelViewSet):
    """
    API endpoint for listing, retrieving, creating, and updating courses with flexible elective rules.
    """
    serializer_class = CourseSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsFacultyUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = (
            Course.objects.filter(is_active=True)
            .prefetch_related('sections__schedules', 'prerequisites__prerequisite_course')
        )

        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        search = self.request.query_params.get('q')
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search) |
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(department__icontains=search)
            )

        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(department__iexact=department)

        credits_param = self.request.query_params.get('credits')
        if credits_param:
            try:
                queryset = queryset.filter(credits=int(credits_param))
            except ValueError:
                pass

        return queryset

    def perform_create(self, serializer):
        capacity = serializer.validated_data.pop('capacity', 30)
        user = getattr(self.request, 'user', None)
        instructor = user if (user and user.is_authenticated and getattr(user, 'is_faculty', False)) else None
        
        course = serializer.save(instructor=instructor)
        
        # Automatically create default section for this elective
        instructor_name = (user.get_full_name() or user.username) if instructor else "Faculty Instructor"
        Section.objects.get_or_create(
            course=course,
            section_number='01',
            term='Fall 2026',
            defaults={
                'capacity': capacity or 30,
                'instructor_name': instructor_name,
                'status': Section.Status.OPEN,
            }
        )

    def perform_update(self, serializer):
        capacity = serializer.validated_data.pop('capacity', None)
        course = serializer.save()
        if capacity is not None:
            # Update section 01 capacity
            sec = course.sections.filter(term='Fall 2026').first()
            if sec:
                sec.capacity = int(capacity)
                sec.save(update_fields=['capacity', 'updated_at'])

    @action(detail=False, methods=['get'])
    def departments(self, request):
        """Returns distinct list of active departments."""
        depts = Course.objects.filter(is_active=True).values_list('department', flat=True).distinct()
        return Response(sorted(list(depts)))


class SectionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for listing, retrieving, and managing individual course sections.
    """
    serializer_class = SectionSerializer

    def get_queryset(self):
        queryset = Section.objects.select_related('course').prefetch_related('schedules').all()

        term = self.request.query_params.get('term')
        if term:
            queryset = queryset.filter(term=term)

        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        open_only = self.request.query_params.get('open_only')
        if open_only and open_only.lower() in ('true', '1'):
            queryset = queryset.filter(status=Section.Status.OPEN)

        return queryset


class RegistrationViewSet(viewsets.ViewSet):
    """
    API endpoint handling course registration with window gating, prerequisite checking,
    clash detection, and atomic idempotency.
    """

    def list(self, request):
        """List all active registrations for the current student."""
        student = resolve_student(request)
        registrations = (
            Registration.objects.filter(student=student, status=Registration.Status.REGISTERED)
            .select_related('section', 'section__course')
            .prefetch_related('section__schedules')
            .order_by('-registered_at')
        )
        serializer = RegistrationSerializer(registrations, many=True)
        return Response(serializer.data)

    def create(self, request):
        """
        Idempotent registration endpoint gated by cohort windows, prerequisites, and timetable clashes.
        """
        serializer = RegisterRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        section_id = serializer.validated_data['section_id']
        idempotency_key = (
            request.headers.get('Idempotency-Key')
            or request.headers.get('X-Idempotency-Key')
            or serializer.validated_data.get('idempotency_key')
        )
        if idempotency_key:
            idempotency_key = str(idempotency_key).strip()

        student = resolve_student(request)

        try:
            registration, created = claim_seat_and_register(
                student=student,
                section_id=section_id,
                idempotency_key=idempotency_key
            )
            data = RegistrationSerializer(registration).data

            if created:
                return Response(
                    {
                        'status': 'success',
                        'message': f"Enrolled successfully in {registration.section.course.code}-{registration.section.section_number}.",
                        'idempotent': False,
                        'registration': data,
                    },
                    status=status.HTTP_201_CREATED
                )
            else:
                return Response(
                    {
                        'status': 'success',
                        'message': f"Already registered for {registration.section.course.code}-{registration.section.section_number}.",
                        'idempotent': True,
                        'registration': data,
                    },
                    status=status.HTTP_200_OK
                )

        # 403 Forbidden: Registration Window closed or not open yet
        except RegistrationWindowForbiddenError as e:
            return Response(
                {
                    'error': 'RegistrationWindowForbidden',
                    'detail': str(e),
                    'code': 'WINDOW_CLOSED',
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # 400 Bad Request: Missing Prerequisite
        except PrerequisiteNotMetError as e:
            return Response(
                {
                    'error': 'PrerequisiteNotMetError',
                    'detail': str(e),
                    'code': 'MISSING_PREREQUISITE',
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 409 Conflict: Timetable Clash
        except TimetableClashError as e:
            return Response(
                {
                    'error': 'TimetableClashError',
                    'detail': str(e),
                    'code': 'TIMETABLE_CLASH',
                },
                status=status.HTTP_409_CONFLICT
            )

        except SectionNotFoundError as e:
            return Response({'error': 'SectionNotFoundError', 'detail': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except SectionFullError as e:
            return Response({'error': 'SectionFullError', 'detail': str(e)}, status=status.HTTP_409_CONFLICT)
        except CourseConflictError as e:
            return Response({'error': 'CourseConflictError', 'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except CreditLimitExceededError as e:
            return Response({'error': 'CreditLimitExceededError', 'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except RegistrationClosedError as e:
            return Response({'error': 'RegistrationClosedError', 'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except RegistrationError as e:
            return Response({'error': 'RegistrationError', 'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Unexpected error during registration: %s", e)
            return Response(
                {'error': 'InternalServerError', 'detail': 'An unexpected error occurred during registration.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def drop(self, request, pk=None):
        """Drop an active registration and free the seat."""
        student = resolve_student(request)
        try:
            dropped_reg = drop_registration(student=student, registration_id=int(pk))
            return Response({
                'status': 'success',
                'message': f"Dropped {dropped_reg.section.course.code}-{dropped_reg.section.section_number}.",
                'registration_id': dropped_reg.id,
            })
        except RegistrationError as e:
            return Response({'error': 'RegistrationError', 'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EligibilityViewSet(viewsets.ViewSet):
    """
    API endpoint returning course and section eligibility snapshots for the student.
    """
    def list(self, request):
        student = resolve_student(request)
        term = request.query_params.get('term', 'Fall 2026')
        course_id = request.query_params.get('course_id')

        if course_id:
            course = Course.objects.filter(id=course_id).first()
            if not course:
                return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
            eval_data = evaluate_course_eligibility(student, course, term=term)
            return Response(eval_data)

        # Precompute or fetch all snapshots for student
        snapshots_dict = precompute_all_snapshots_for_student(student, term=term)
        return Response(snapshots_dict)


class CartViewSet(viewsets.ViewSet):
    """
    Cart endpoints validating prerequisites and schedule clashes prior to registration.
    """
    def list(self, request):
        student = resolve_student(request)
        items = CartItem.objects.filter(student=student).select_related('section', 'section__course').prefetch_related('section__schedules')
        serializer = CartItemSerializer(items, many=True)
        return Response(serializer.data)

    def create(self, request):
        student = resolve_student(request)
        section_id = request.data.get('section_id')
        if not section_id:
            return Response({'error': 'section_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cart_item = add_section_to_cart(student, int(section_id))
            serializer = CartItemSerializer(cart_item)
            return Response(
                {'status': 'success', 'message': 'Added to cart.', 'cart_item': serializer.data},
                status=status.HTTP_201_CREATED
            )
        except PrerequisiteNotMetError as e:
            return Response({'error': 'PrerequisiteNotMetError', 'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except TimetableClashError as e:
            return Response({'error': 'TimetableClashError', 'detail': str(e)}, status=status.HTTP_409_CONFLICT)
        except Exception as e:
            return Response({'error': 'CartError', 'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        student = resolve_student(request)
        item = CartItem.objects.filter(id=pk, student=student).first()
        if not item:
            return Response({'error': 'Item not found in cart'}, status=status.HTTP_404_NOT_FOUND)
        item.delete()
        return Response({'status': 'success', 'message': 'Removed from cart'})


class StudentProfileView(APIView):
    """
    Returns or updates current student profile.
    """
    def get(self, request):
        student = resolve_student(request)
        serializer = StudentSerializer(student)
        return Response(serializer.data)

    def put(self, request):
        return self.update_profile(request)

    def patch(self, request):
        return self.update_profile(request)

    def update_profile(self, request):
        student = resolve_student(request)
        data = request.data

        if 'name' in data and data['name']:
            parts = str(data['name']).strip().split()
            student.user.first_name = parts[0]
            student.user.last_name = " ".join(parts[1:]) if len(parts) > 1 else ''
            student.user.save()

        if 'degree' in data and data['degree']:
            student.degree = str(data['degree']).strip()
        if 'branch' in data and data['branch']:
            student.branch = str(data['branch']).strip()
            student.major = str(data['branch']).strip()
        if 'semester' in data and data['semester'] is not None:
            try:
                sem = int(data['semester'])
                student.semester = sem
                if sem in [5, 6]:
                    student.academic_year = 'Junior'
                elif sem in [3, 4]:
                    student.academic_year = 'Sophomore'
                elif sem >= 7:
                    student.academic_year = 'Senior'
                else:
                    student.academic_year = 'Freshman'
            except (ValueError, TypeError):
                pass

        if 'cgpa' in data and data['cgpa'] is not None:
            try:
                student.cgpa = round(float(data['cgpa']), 2)
            except (ValueError, TypeError):
                pass

        student.profile_completed = True
        student.save()

        return Response({
            'status': 'success',
            'message': 'Profile updated successfully.',
            'student': StudentSerializer(student).data,
        })


class StudentListView(APIView):
    """
    Returns all demo students to support seamless persona switching in the frontend.
    """
    def get(self, request):
        students = Student.objects.select_related('user', 'cohort').all()
        serializer = StudentSerializer(students, many=True)
        return Response(serializer.data)
