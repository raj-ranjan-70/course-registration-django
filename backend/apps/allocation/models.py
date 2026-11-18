from django.db import models


class ElectivePreference(models.Model):
    student = models.ForeignKey(
        'accounts.Student',
        on_delete=models.CASCADE,
        related_name='elective_preferences'
    )
    course = models.ForeignKey(
        'courses.Course',
        on_delete=models.CASCADE,
        related_name='elective_preferences'
    )
    preference_rank = models.PositiveIntegerField()
    term = models.CharField(max_length=50, default='Fall 2026', db_index=True)
    submitted_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['student', 'preference_rank']
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'course', 'term'],
                name='unique_student_course_preference'
            ),
            models.UniqueConstraint(
                fields=['student', 'preference_rank', 'term'],
                name='unique_student_rank_preference'
            ),
            models.CheckConstraint(
                condition=models.Q(preference_rank__gte=1),
                name='preference_rank_gte_1'
            ),
        ]

    def __str__(self):
        return f"{self.student.student_id} -> Rank {self.preference_rank}: {self.course.code} ({self.term})"


class AllocationRun(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        RUNNING = 'RUNNING', 'Running'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    term = models.CharField(max_length=50, default='Fall 2026', db_index=True)
    seed = models.CharField(max_length=128, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    algorithm = models.CharField(max_length=100, default='Deferred Acceptance (Gale-Shapley)')
    config = models.JSONField(default=dict)
    total_students = models.PositiveIntegerField(default=0)
    total_courses = models.PositiveIntegerField(default=0)
    total_matched = models.PositiveIntegerField(default=0)
    total_unmatched = models.PositiveIntegerField(default=0)
    satisfaction_rate = models.FloatField(default=0.0)
    rank_distribution = models.JSONField(default=dict)
    execution_time_ms = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"AllocationRun #{self.id} [{self.term}] - {self.status} (Seed: {self.seed})"


class AllocationResult(models.Model):
    allocation_run = models.ForeignKey(
        AllocationRun,
        on_delete=models.CASCADE,
        related_name='results'
    )
    student = models.ForeignKey(
        'accounts.Student',
        on_delete=models.CASCADE,
        related_name='allocation_results'
    )
    course = models.ForeignKey(
        'courses.Course',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='allocation_results'
    )
    assigned_section = models.ForeignKey(
        'courses.Section',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='allocation_results'
    )
    matched = models.BooleanField(default=False)
    preference_rank = models.PositiveIntegerField(null=True, blank=True)
    priority_score = models.FloatField(default=0.0)
    tiebreaker_value = models.FloatField(default=0.0)
    audit_details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['allocation_run', 'student__student_id']

    def __str__(self):
        course_str = self.course.code if self.course else 'Unmatched'
        rank_str = f"Rank {self.preference_rank}" if self.preference_rank else 'None'
        return f"Run #{self.allocation_run_id} | {self.student.student_id} -> {course_str} ({rank_str})"
