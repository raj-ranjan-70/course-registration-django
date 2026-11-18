from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Student, Cohort


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Role Information', {'fields': ('role',)}),
    )
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_superuser')


@admin.register(Cohort)
class CohortAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'created_at')
    search_fields = ('code', 'name')


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('student_id', 'user', 'cohort', 'major', 'academic_year', 'max_credits')
    search_fields = ('student_id', 'user__username', 'user__first_name', 'user__last_name', 'user__email')
    list_filter = ('cohort', 'major', 'academic_year')
