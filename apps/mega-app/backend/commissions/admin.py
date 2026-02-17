from django.contrib import admin
from .models import CommissionSession, CommissionEvaluation, CommissionArticleResult


class CommissionArticleResultInline(admin.TabularInline):
    model = CommissionArticleResult
    extra = 0
    fields = ['article', 'program_result', 'behavior_result', 'decision', 'notes']


class CommissionEvaluationInline(admin.TabularInline):
    model = CommissionEvaluation
    extra = 0
    fields = ['person', 'notes']
    show_change_link = True


@admin.register(CommissionSession)
class CommissionSessionAdmin(admin.ModelAdmin):
    list_display = ['session_date', 'session_number', 'year', 'month', 'description', 'created_by', 'created_at']
    list_filter = ['year', 'month']
    search_fields = ['session_number', 'description']
    readonly_fields = ['year', 'month', 'created_by', 'created_at', 'updated_at']
    ordering = ['-session_date']
    inlines = [CommissionEvaluationInline]

    fieldsets = (
        ('Sedinta', {
            'fields': ('session_date', 'year', 'month', 'session_number', 'description')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(CommissionEvaluation)
class CommissionEvaluationAdmin(admin.ModelAdmin):
    list_display = ['person', 'session', 'notes']
    list_filter = ['session__year', 'session__month']
    search_fields = ['person__first_name', 'person__last_name', 'person__cnp']
    inlines = [CommissionArticleResultInline]
