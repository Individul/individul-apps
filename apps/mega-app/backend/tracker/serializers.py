from rest_framework import serializers
from .models import Issue


class IssueListSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Issue
        fields = [
            'id', 'title', 'category', 'category_display',
            'priority', 'priority_display', 'status', 'status_display',
            'module_name', 'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name or obj.created_by.username
        return None


class IssueDetailSerializer(IssueListSerializer):
    class Meta(IssueListSerializer.Meta):
        fields = IssueListSerializer.Meta.fields + [
            'description', 'steps_to_reproduce', 'expected_behavior',
            'actual_behavior', 'resolution_notes',
        ]


class IssueCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Issue
        fields = [
            'title', 'description', 'category', 'priority',
            'module_name', 'steps_to_reproduce', 'expected_behavior',
            'actual_behavior',
        ]

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Titlul nu poate fi gol.")
        return value.strip()


class IssueUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Issue
        fields = [
            'title', 'description', 'category', 'priority', 'status',
            'module_name', 'steps_to_reproduce', 'expected_behavior',
            'actual_behavior', 'resolution_notes',
        ]
