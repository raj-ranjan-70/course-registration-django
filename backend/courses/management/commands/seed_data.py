from django.core.management.base import BaseCommand
from accounts.models import User, Student, Cohort
from courses.models import (
    Course,
    Section,
    Prerequisite,
    StudentCourseHistory,
    ClassSchedule,
    RegistrationWindow,
    CartItem,
    Registration,
    EligibilitySnapshot,
)
from apps.allocation.models import (
    ElectivePreference,
    AllocationRun,
    AllocationResult,
)


class Command(BaseCommand):
    help = 'Wipes all mock data and seeds strictly 4 demo accounts (2 Faculty, 2 Students) with zero pre-created electives.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Wiping out all existing mock courses, electives, allocations, and seed data..."))

        # 1. Clean up allocation models
        AllocationResult.objects.all().delete()
        AllocationRun.objects.all().delete()
        ElectivePreference.objects.all().delete()

        # 2. Clean up registration and course models
        EligibilitySnapshot.objects.all().delete()
        CartItem.objects.all().delete()
        Registration.objects.all().delete()
        ClassSchedule.objects.all().delete()
        Section.objects.all().delete()
        Prerequisite.objects.all().delete()
        StudentCourseHistory.objects.all().delete()
        Course.objects.all().delete()
        RegistrationWindow.objects.all().delete()

        # 3. Clean up students and users
        Student.objects.all().delete()
        User.objects.all().delete()
        Cohort.objects.all().delete()

        self.stdout.write(self.style.SUCCESS("All previous mock data wiped cleanly."))

        # 4. Create base cohort for student profile association
        cohort = Cohort.objects.create(
            name="Junior Cohort (Class of 2027)",
            code="BATCH_2027",
            description="Third-year undergraduate students."
        )

        default_password = "Password@123"

        # 5. Create Strictly 2 Faculty Accounts
        faculty_users_data = [
            {
                'username': 'faculty1',
                'email': 'faculty1@univ.edu',
                'first_name': 'Dr. Alan',
                'last_name': 'Turing',
                'role': User.Role.FACULTY,
            },
            {
                'username': 'faculty2',
                'email': 'faculty2@univ.edu',
                'first_name': 'Dr. Grace',
                'last_name': 'Hopper',
                'role': User.Role.FACULTY,
            },
        ]

        self.stdout.write("Creating 2 Faculty Accounts...")
        for fac_data in faculty_users_data:
            user = User.objects.create_user(
                username=fac_data['username'],
                email=fac_data['email'],
                password=default_password,
                first_name=fac_data['first_name'],
                last_name=fac_data['last_name'],
                role=fac_data['role'],
                is_staff=True,
            )
            self.stdout.write(self.style.SUCCESS(
                f"  -> Faculty: {user.get_full_name()} | Username: {user.username} | Email: {user.email} | Password: {default_password}"
            ))

        # 6. Create Strictly 2 Student Accounts
        student_data = [
            {
                'username': 'student1',
                'email': 'student1@univ.edu',
                'first_name': 'Alice',
                'last_name': 'Chen',
                'student_id': 'REG2026001',
                'degree': 'B.Tech',
                'branch': 'Computer Science',
                'semester': 5,
                'cgpa': 8.9,
            },
            {
                'username': 'student2',
                'email': 'student2@univ.edu',
                'first_name': 'Bob',
                'last_name': 'Miller',
                'student_id': 'REG2026002',
                'degree': 'B.Tech',
                'branch': 'Electrical Engineering',
                'semester': 5,
                'cgpa': 8.2,
            },
        ]

        self.stdout.write("Creating 2 Student Accounts...")
        for stu in student_data:
            user = User.objects.create_user(
                username=stu['username'],
                email=stu['email'],
                password=default_password,
                first_name=stu['first_name'],
                last_name=stu['last_name'],
                role=User.Role.STUDENT,
            )
            student = Student.objects.create(
                user=user,
                student_id=stu['student_id'],
                cohort=cohort,
                degree=stu['degree'],
                branch=stu['branch'],
                major=stu['branch'],
                semester=stu['semester'],
                academic_year='Junior',
                cgpa=stu['cgpa'],
                max_credits=18,
                profile_completed=True,
            )
            self.stdout.write(self.style.SUCCESS(
                f"  -> Student: {user.get_full_name()} | Reg No: {student.student_id} | Email: {user.email} | Password: {default_password}"
            ))

        self.stdout.write(self.style.SUCCESS(
            "\nSeed completed! Strictly 4 accounts exist. Zero courses created (Faculty will create courses via dashboard)."
        ))
