from django.db import models
from django.utils import timezone


class ElectiveGroup(models.Model):
    """
    Represents an Elective Offering (basket/group) containing multiple courses.
    Whole-elective criteria: semester, degree, branch, general CGPA (all optional).
    Submission deadline is required.
    Supports step-by-step multi-step creation and draft restoration.
    """
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    department = models.CharField(max_length=100, blank=True, default='')
    term = models.CharField(max_length=50, default='Fall 2026', db_index=True)
    submission_deadline = models.DateTimeField(null=True, blank=True)  # Required on Step 1, nullable for intermediate drafts
    is_draft = models.BooleanField(default=False, db_index=True)
    current_step = models.PositiveSmallIntegerField(default=1)  # 1: Details, 2: Courses, 3: Criteria
    is_published = models.BooleanField(default=False)
    results_published_at = models.DateTimeField(null=True, blank=True)

    # Whole-elective optional criteria
    min_cgpa = models.FloatField(null=True, blank=True)
    allowed_semesters = models.JSONField(default=list, blank=True)
    target_degrees = models.JSONField(default=list, blank=True)
    target_branches = models.JSONField(default=list, blank=True)
    max_preferences = models.PositiveIntegerField(default=5)
    allow_preference_editing = models.BooleanField(default=True)  # Whether students can edit preferences before deadline

    instructor = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_electives'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.term})"

    @property
    def is_deadline_passed(self) -> bool:
        if not self.submission_deadline:
            return False
        return timezone.now() > self.submission_deadline


class Course(models.Model):
    class Category(models.TextChoices):
        DEPARTMENT = 'DEPARTMENT', 'Department Elective'
        OPEN = 'OPEN', 'Open Elective'

    elective_group = models.ForeignKey(
        ElectiveGroup,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='courses'
    )
    code = models.CharField(max_length=20, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    department = models.CharField(max_length=100, db_index=True)
    credits = models.PositiveIntegerField(default=3)
    capacity = models.PositiveIntegerField(default=30)  # Individual course seat capacity
    is_active = models.BooleanField(default=True)

    # Faculty Elective Configuration & Flexible Rules
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.DEPARTMENT)
    target_degrees = models.JSONField(default=list, blank=True)
    target_branches = models.JSONField(default=list, blank=True)
    min_cgpa = models.FloatField(null=True, blank=True)  # Individual course CGPA cutoff
    allowed_semesters = models.JSONField(default=list, blank=True)
    max_preferences = models.PositiveIntegerField(default=5)
    submission_deadline = models.DateTimeField(null=True, blank=True)
    instructor = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_courses'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.title}"

    @property
    def is_submission_open(self) -> bool:
        if not self.submission_deadline:
            return True
        return timezone.now() <= self.submission_deadline


class Prerequisite(models.Model):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='prerequisites'
    )
    prerequisite_course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='prerequisite_for'
    )
    min_grade = models.CharField(max_length=5, default='C')
    is_mandatory = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['course', 'prerequisite_course'],
                name='unique_course_prerequisite'
            )
        ]

    def __str__(self):
        return f"{self.course.code} requires {self.prerequisite_course.code} (>= {self.min_grade})"


class StudentCourseHistory(models.Model):
    """Tracks courses a student has completed in prior terms."""
    student = models.ForeignKey(
        'accounts.Student',
        on_delete=models.CASCADE,
        related_name='completed_courses'
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='completions'
    )
    grade = models.CharField(max_length=5, default='A')
    passed = models.BooleanField(default=True)
    term_completed = models.CharField(max_length=50, default='Spring 2026')
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-completed_at']
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'course'],
                name='unique_student_course_completion'
            )
        ]

    def __str__(self):
        return f"{self.student.student_id}: {self.course.code} [{self.grade}, passed={self.passed}]"


class Section(models.Model):
    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        CLOSED = 'CLOSED', 'Closed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='sections')
    section_number = models.CharField(max_length=10)
    term = models.CharField(max_length=50, default='Fall 2026', db_index=True)
    instructor_name = models.CharField(max_length=150, blank=True)
    schedule = models.CharField(max_length=120, blank=True)
    classroom = models.CharField(max_length=100, blank=True)
    capacity = models.PositiveIntegerField(default=30)
    enrolled_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['course__code', 'section_number']
        constraints = [
            models.UniqueConstraint(
                fields=['course', 'section_number', 'term'],
                name='unique_course_section_term'
            ),
            models.CheckConstraint(
                condition=models.Q(enrolled_count__gte=0),
                name='enrolled_count_non_negative'
            ),
            models.CheckConstraint(
                condition=models.Q(enrolled_count__lte=models.F('capacity')),
                name='enrolled_count_lte_capacity'
            ),
        ]

    def __str__(self):
        return f"{self.course.code}-{self.section_number} ({self.term})"

    @property
    def available_seats(self) -> int:
        return max(0, self.capacity - self.enrolled_count)

    @property
    def is_full(self) -> bool:
        return self.enrolled_count >= self.capacity


class ClassSchedule(models.Model):
    class DayOfWeek(models.TextChoices):
        MON = 'MON', 'Monday'
        TUE = 'TUE', 'Tuesday'
        WED = 'WED', 'Wednesday'
        THU = 'THU', 'Thursday'
        FRI = 'FRI', 'Friday'
        SAT = 'SAT', 'Saturday'
        SUN = 'SUN', 'Sunday'

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name='schedules'
    )
    day = models.CharField(max_length=10, choices=DayOfWeek.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    location = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['day', 'start_time']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(start_time__lt=models.F('end_time')),
                name='schedule_start_before_end'
            )
        ]

    def __str__(self):
        return f"{self.section}: {self.day} {self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')}"

    def clashes_with(self, other: 'ClassSchedule') -> bool:
        """
        Returns True if this schedule interval overlaps with another schedule slot on the same day.
        Formula: day == other.day and start_time < other.end_time and other.start_time < end_time
        """
        if self.day != other.day:
            return False
        return self.start_time < other.end_time and other.start_time < self.end_time


class RegistrationWindow(models.Model):
    class Status(models.TextChoices):
        UPCOMING = 'UPCOMING', 'Upcoming'
        ACTIVE = 'ACTIVE', 'Active'
        CLOSED = 'CLOSED', 'Closed'

    cohort = models.ForeignKey(
        'accounts.Cohort',
        on_delete=models.CASCADE,
        related_name='registration_windows'
    )
    term = models.CharField(max_length=50, default='Fall 2026', db_index=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f"Window for {self.cohort.name} ({self.term}): {self.status}"

    def is_currently_open(self) -> bool:
        """Evaluates whether the window is active and current time falls within start and end time."""
        if self.status != self.Status.ACTIVE:
            return False
        now = timezone.now()
        return self.start_time <= now <= self.end_time

    @property
    def current_state(self) -> str:
        now = timezone.now()
        if self.status == self.Status.CLOSED or now > self.end_time:
            return self.Status.CLOSED
        if now < self.start_time:
            return self.Status.UPCOMING
        return self.Status.ACTIVE


class CartItem(models.Model):
    student = models.ForeignKey(
        'accounts.Student',
        on_delete=models.CASCADE,
        related_name='cart_items'
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name='in_carts'
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-added_at']
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'section'],
                name='unique_student_cart_section'
            )
        ]

    def __str__(self):
        return f"Cart: {self.student.student_id} -> {self.section}"


class Registration(models.Model):
    class Status(models.TextChoices):
        REGISTERED = 'REGISTERED', 'Registered'
        DROPPED = 'DROPPED', 'Dropped'
        WAITLISTED = 'WAITLISTED', 'Waitlisted'

    student = models.ForeignKey('accounts.Student', on_delete=models.CASCADE, related_name='registrations')
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='registrations')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REGISTERED)
    idempotency_key = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    registered_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-registered_at']
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'section'],
                condition=models.Q(status='REGISTERED'),
                name='unique_active_student_section_registration'
            ),
        ]

    def __str__(self):
        return f"{self.student.student_id} -> {self.section} [{self.status}]"


class EligibilitySnapshot(models.Model):
    student = models.ForeignKey(
        'accounts.Student',
        on_delete=models.CASCADE,
        related_name='eligibility_snapshots'
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='eligibility_snapshots'
    )
    eligible = models.BooleanField(default=True)
    reasons = models.JSONField(default=list)
    section_eligibility = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['course__code']
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'course'],
                name='unique_student_course_eligibility_snapshot'
            )
        ]

    def __str__(self):
        status_str = "Eligible" if self.eligible else "Ineligible"
        return f"{self.student.student_id} -> {self.course.code} [{status_str}]"
