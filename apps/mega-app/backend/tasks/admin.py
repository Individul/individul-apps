from django.contrib import admin
from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'status', 'priority', 'category', 'deadline', 'created_at']
    list_filter = ['status', 'priority', 'category']
    search_fields = ['title', 'description']
    ordering = ['-created_at']
