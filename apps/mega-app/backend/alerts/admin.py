from django.contrib import admin
from .models import Alert


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['user', 'alert_type', 'priority', 'person', 'target_date', 'is_read', 'created_at']
    list_filter = ['alert_type', 'priority', 'is_read', 'target_date']
    search_fields = ['person__first_name', 'person__last_name', 'message']
    readonly_fields = ['id', 'created_at']
    ordering = ['-created_at']
