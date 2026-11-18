from django.contrib import admin
from .models import (
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


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'title', 'department', 'credits', 'is_active')
    search_fields = ('code', 'title', 'department')
    list_filter = ('department', 'credits', 'is_active')


class ClassScheduleInline(admin.TabularInline):
    model = ClassSchedule
    extra = 1


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'term', 'instructor_name', 'schedule', 'capacity', 'enrolled_count', 'status')
    search_fields = ('course__code', 'course__title', 'instructor_name', 'section_number')
    list_filter = ('term', 'status')
    inlines = [ClassScheduleInline]


@admin.register(ClassSchedule)
class ClassScheduleAdmin(admin.ModelAdmin):
    list_display = ('section', 'day', 'start_time', 'end_time', 'location')
    list_filter = ('day',)


@admin.register(Prerequisite)
class PrerequisiteAdmin(admin.ModelAdmin):
    list_display = ('course', 'prerequisite_course', 'min_grade', 'is_mandatory')
    search_fields = ('course__code', 'prerequisite_course__code')


@admin.register(StudentCourseHistory)
class StudentCourseHistoryAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'grade', 'passed', 'term_completed')
    search_fields = ('student__student_id', 'course__code')
    list_filter = ('passed', 'term_completed')


@admin.register(RegistrationWindow)
class RegistrationWindowAdmin(admin.ModelAdmin):
    list_display = ('cohort', 'term', 'status', 'start_time', 'end_time')
    list_filter = ('term', 'status', 'cohort')


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ('student', 'section', 'added_at')
    search_fields = ('student__student_id', 'section__course__code')


@admin.register(Registration)
class RegistrationAdmin(admin.ModelAdmin):
    list_display = ('student', 'section', 'status', 'idempotency_key', 'registered_at')
    search_fields = ('student__student_id', 'student__user__username', 'section__course__code', 'idempotency_key')
    list_filter = ('status', 'registered_at')


@admin.register(EligibilitySnapshot)
class EligibilitySnapshotAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'eligible', 'updated_at')
    search_fields = ('student__student_id', 'course__code')
    list_filter = ('eligible',)
