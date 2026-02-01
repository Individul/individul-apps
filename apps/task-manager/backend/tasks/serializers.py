from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Task, TaskActivity


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


class TaskActivitySerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = TaskActivity
        fields = [
            'id',
            'action',
            'action_display',
            'user',
            'user_details',
            'details',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class TaskSerializer(serializers.ModelSerializer):
    assignee_details = UserSerializer(source='assignee', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'status',
            'priority',
            'category',
            'tags',
            'deadline',
            'assignee',
            'assignee_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Titlul nu poate fi gol.")
        return value.strip()


class TaskDetailSerializer(TaskSerializer):
    activities = TaskActivitySerializer(many=True, read_only=True)

    class Meta(TaskSerializer.Meta):
        fields = TaskSerializer.Meta.fields + ['activities']
