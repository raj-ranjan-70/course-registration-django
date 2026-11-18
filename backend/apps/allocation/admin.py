from django.contrib import admin
from .models import ElectivePreference, AllocationRun, AllocationResult


@admin.register(ElectivePreference)
class ElectivePreferenceAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'preference_rank', 'term', 'submitted_at')
    list_filter = ('term', 'preference_rank')
    search_fields = ('student__student_id', 'course__code')


class AllocationResultInline(admin.TabularInline):
    model = AllocationResult
    extra = 0
    readonly_fields = ('student', 'course', 'matched', 'preference_rank', 'priority_score', 'tiebreaker_value')


@admin.register(AllocationRun)
class AllocationRunAdmin(admin.ModelAdmin):
    list_display = ('id', 'term', 'seed', 'status', 'total_matched', 'total_students', 'satisfaction_rate', 'created_at')
    list_filter = ('term', 'status')
    search_fields = ('seed',)
    inlines = [AllocationResultInline]


@admin.register(AllocationResult)
class AllocationResultAdmin(admin.ModelAdmin):
    list_display = ('allocation_run', 'student', 'course', 'matched', 'preference_rank', 'priority_score', 'tiebreaker_value')
    list_filter = ('matched', 'preference_rank')
    search_fields = ('student__student_id', 'course__code', 'allocation_run__seed')
