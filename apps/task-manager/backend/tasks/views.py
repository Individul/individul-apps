from rest_framework import viewsets, filters
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, CharFilter
from django.contrib.auth.models import User
from django.db.models import Q
from .models import Task
from .serializers import TaskSerializer, UserSerializer


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
