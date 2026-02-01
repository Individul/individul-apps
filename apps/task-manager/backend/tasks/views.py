from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, action
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, CharFilter
from django.contrib.auth.models import User
from .models import Task, TaskActivity
from .serializers import TaskSerializer, TaskDetailSerializer, TaskActivitySerializer, UserSerializer


class TaskFilter(FilterSet):
    tags = CharFilter(method='filter_tags')

    class Meta:
        model = Task
        fields = ['status', 'priority', 'category', 'assignee', 'tags']

    def filter_tags(self, queryset, name, value):
        if value:
            return queryset.filter(tags__contains=[value])
        return queryset


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_class = TaskFilter
    ordering_fields = ['deadline', 'priority', 'created_at', 'updated_at']
    ordering = ['-created_at']
    search_fields = ['title', 'description']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TaskDetailSerializer
        return TaskSerializer

    def perform_create(self, serializer):
        task = serializer.save()
        TaskActivity.objects.create(
            task=task,
            action=TaskActivity.ActionType.CREATED,
            user=None,
            details={'title': task.title}
        )

    def perform_update(self, serializer):
        old_task = self.get_object()
        old_status = old_task.status
        old_priority = old_task.priority
        old_assignee = old_task.assignee

        task = serializer.save()

        # Log status change
        if old_status != task.status:
            TaskActivity.objects.create(
                task=task,
                action=TaskActivity.ActionType.STATUS_CHANGED,
                user=None,
                details={
                    'old_status': old_status,
                    'new_status': task.status
                }
            )

        # Log priority change
        if old_priority != task.priority:
            TaskActivity.objects.create(
                task=task,
                action=TaskActivity.ActionType.PRIORITY_CHANGED,
                user=None,
                details={
                    'old_priority': old_priority,
                    'new_priority': task.priority
                }
            )

        # Log assignee change
        if old_assignee != task.assignee:
            if task.assignee:
                TaskActivity.objects.create(
                    task=task,
                    action=TaskActivity.ActionType.ASSIGNED,
                    user=None,
                    details={
                        'assignee_id': task.assignee.id,
                        'assignee_name': f"{task.assignee.first_name} {task.assignee.last_name}".strip()
                    }
                )
            else:
                TaskActivity.objects.create(
                    task=task,
                    action=TaskActivity.ActionType.UNASSIGNED,
                    user=None,
                    details={
                        'old_assignee_name': f"{old_assignee.first_name} {old_assignee.last_name}".strip() if old_assignee else None
                    }
                )

    @action(detail=True, methods=['post'])
    def comment(self, request, pk=None):
        task = self.get_object()
        comment_text = request.data.get('comment', '')
        user_id = request.data.get('user_id')

        user = None
        if user_id:
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                pass

        if not comment_text.strip():
            return Response(
                {'error': 'Comentariul nu poate fi gol.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        activity = TaskActivity.objects.create(
            task=task,
            action=TaskActivity.ActionType.COMMENT,
            user=user,
            details={'comment': comment_text.strip()}
        )

        serializer = TaskActivitySerializer(activity)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        # Handle custom priority ordering
        ordering = request.query_params.get('ordering', '')
        if 'priority' in ordering:
            priority_order = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
            queryset = sorted(
                queryset,
                key=lambda x: priority_order.get(x.priority, 1),
                reverse=ordering.startswith('-')
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


@api_view(['GET'])
def user_list(request):
    users = User.objects.filter(is_active=True).order_by('first_name', 'last_name')
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def category_list(request):
    categories = Task.objects.exclude(category='').values_list('category', flat=True).distinct().order_by('category')
    return Response(list(categories))


@api_view(['GET'])
def tag_list(request):
    tasks_with_tags = Task.objects.exclude(tags=[])
    all_tags = set()
    for task in tasks_with_tags:
        all_tags.update(task.tags)
    return Response(sorted(list(all_tags)))
