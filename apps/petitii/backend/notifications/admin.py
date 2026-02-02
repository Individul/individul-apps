from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'user', 'type', 'petition', 'is_read']
    list_filter = ['type', 'is_read', 'created_at']
    search_fields = ['user__username', 'message']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at']
