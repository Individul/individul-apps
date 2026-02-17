from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    petition_number = serializers.CharField(source='petition.registration_number', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'type', 'type_display', 'petition', 'petition_number',
            'message', 'due_date', 'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'type', 'petition', 'message', 'due_date', 'created_at']
