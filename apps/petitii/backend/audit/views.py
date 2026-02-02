from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import AuditLog
from .serializers import AuditLogSerializer
from accounts.permissions import IsAdmin


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related('actor')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = {
        'action': ['exact', 'in'],
        'entity_type': ['exact'],
        'entity_id': ['exact'],
        'actor': ['exact'],
        'created_at': ['gte', 'lte', 'date'],
    }
    search_fields = ['actor_username', 'entity_type', 'entity_id']
    ordering_fields = ['created_at', 'action']
    ordering = ['-created_at']
