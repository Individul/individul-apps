from rest_framework import serializers
from .models import Alert


class AlertSerializer(serializers.ModelSerializer):
    alert_type_display = serializers.CharField(source='get_alert_type_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    person_name = serializers.CharField(source='person.full_name', read_only=True)
    fraction_type = serializers.CharField(source='fraction.fraction_type', read_only=True)

    class Meta:
        model = Alert
        fields = [
            'id', 'user', 'alert_type', 'alert_type_display',
            'priority', 'priority_display', 'fraction', 'fraction_type',
            'person', 'person_name', 'message', 'target_date',
            'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'alert_type', 'priority', 'fraction', 'person', 'message', 'target_date', 'created_at']


class AlertDashboardSerializer(serializers.Serializer):
    overdue = serializers.IntegerField()
    imminent = serializers.IntegerField()
    upcoming = serializers.IntegerField()
    fulfilled = serializers.IntegerField()
    total = serializers.IntegerField()
