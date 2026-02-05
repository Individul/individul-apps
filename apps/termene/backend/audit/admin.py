from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['actor_username', 'action', 'entity_type', 'entity_id', 'created_at']
    list_filter = ['action', 'entity_type', 'created_at']
    search_fields = ['actor_username', 'entity_type', 'entity_id']
    readonly_fields = [
        'id', 'actor', 'actor_username', 'action', 'entity_type', 'entity_id',
        'before_json', 'after_json', 'ip_address', 'user_agent', 'created_at'
    ]
    ordering = ['-created_at']
