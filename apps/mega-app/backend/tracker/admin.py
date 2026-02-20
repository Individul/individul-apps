from django.contrib import admin
from .models import Issue


@admin.register(Issue)
class IssueAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'priority', 'status', 'module_name', 'created_by', 'created_at']
    list_filter = ['category', 'priority', 'status']
    search_fields = ['title', 'description', 'module_name']
    ordering = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']
