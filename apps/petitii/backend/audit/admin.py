from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'actor_username', 'action', 'entity_type', 'entity_id', 'ip_address']
    list_filter = ['action', 'entity_type', 'created_at']
    search_fields = ['actor_username', 'entity_type', 'entity_id', 'ip_address']
    date_hierarchy = 'created_at'
    readonly_fields = [
        'id', 'actor', 'actor_username', 'action', 'entity_type', 'entity_id',
        'before_json', 'after_json', 'ip_address', 'user_agent', 'created_at'
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
