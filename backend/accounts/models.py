from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = 'STUDENT', 'Student'
        FACULTY = 'FACULTY', 'Faculty'
        INSTRUCTOR = 'INSTRUCTOR', 'Instructor'
        ADMIN = 'ADMIN', 'Admin'

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)

    @property
    def is_faculty(self) -> bool:
        return self.role in [self.Role.FACULTY, self.Role.INSTRUCTOR, self.Role.ADMIN] or self.is_staff

    def __str__(self):
        return f"{self.username} ({self.role})"


class Cohort(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Student(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    student_id = models.CharField(max_length=30, unique=True, db_index=True)
    cohort = models.ForeignKey(
        Cohort,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students'
    )
    major = models.CharField(max_length=100, blank=True, default='Computer Science')
    degree = models.CharField(max_length=50, blank=True, default='B.Tech')
    branch = models.CharField(max_length=100, blank=True, default='CSE')
    semester = models.PositiveIntegerField(default=5)
    academic_year = models.CharField(max_length=30, default='Junior')
    cgpa = models.FloatField(default=3.5)
    profile_completed = models.BooleanField(default=True)
    max_credits = models.PositiveIntegerField(default=18)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        full_name = self.user.get_full_name() or self.user.username
        cohort_str = f" - {self.cohort.code}" if self.cohort else ""
        return f"{full_name} [{self.student_id}{cohort_str}]"

    @property
    def total_enrolled_credits(self):
        return sum(
            reg.section.course.credits
            for reg in self.registrations.filter(status='REGISTERED').select_related('section__course')
        )
