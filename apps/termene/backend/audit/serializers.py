from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    changes = serializers.ReadOnlyField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'actor', 'actor_username', 'action', 'action_display',
            'entity_type', 'entity_id', 'before_json', 'after_json',
            'changes', 'ip_address', 'user_agent', 'created_at'
        ]
