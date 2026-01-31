from rest_framework import viewsets, filters
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Task
from .serializers import TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['status', 'priority', 'category']
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
