from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count
from django.utils import timezone
from datetime import timedelta

from accounts.permissions import IsOperatorOrReadOnly
from .models import Issue
from .serializers import (
    IssueListSerializer,
    IssueDetailSerializer,
    IssueCreateSerializer,
    IssueUpdateSerializer,
)


class IssueViewSet(viewsets.ModelViewSet):
    queryset = Issue.objects.select_related('created_by')
    permission_classes = [IsAuthenticated, IsOperatorOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['category', 'priority', 'status']
    ordering_fields = ['created_at', 'updated_at', 'priority', 'status']
    ordering = ['-created_at']
    search_fields = ['title', 'description', 'module_name']

    def get_serializer_class(self):
        if self.action == 'list':
            return IssueListSerializer
        elif self.action == 'create':
            return IssueCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return IssueUpdateSerializer
        return IssueDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        ordering = request.query_params.get('ordering', '')
        if 'priority' in ordering:
            priority_order = {'CRITIC': 0, 'INALT': 1, 'MEDIU': 2, 'SCAZUT': 3}
            queryset = sorted(
                queryset,
                key=lambda x: priority_order.get(x.priority, 2),
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

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        total = qs.count()

        by_status = dict(
            qs.values('status').annotate(count=Count('id')).values_list('status', 'count')
        )
        by_category = dict(
            qs.values('category').annotate(count=Count('id')).values_list('category', 'count')
        )
        by_priority = dict(
            qs.values('priority').annotate(count=Count('id')).values_list('priority', 'count')
        )

        week_ago = timezone.now() - timedelta(days=7)
        recent_count = qs.filter(created_at__gte=week_ago).count()
        resolved_count = qs.filter(
            status__in=[Issue.Status.IMPLEMENTAT, Issue.Status.RESPINS]
        ).count()

        return Response({
            'total': total,
            'by_status': by_status,
            'by_category': by_category,
            'by_priority': by_priority,
            'recent_count': recent_count,
            'resolved_count': resolved_count,
        })

    @action(detail=False, methods=['get'])
    def export_xlsx(self, request):
        from .exports import export_issues_xlsx
        queryset = self.filter_queryset(self.get_queryset())
        return export_issues_xlsx(queryset)
