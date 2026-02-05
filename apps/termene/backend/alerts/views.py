from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Alert
from .serializers import AlertSerializer, AlertDashboardSerializer
from .services import generate_alerts_for_user, get_dashboard_alert_summary


class AlertViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = {
        'alert_type': ['exact', 'in'],
        'priority': ['exact', 'in'],
        'is_read': ['exact'],
        'target_date': ['gte', 'lte'],
    }
    ordering_fields = ['created_at', 'target_date', 'priority']
    ordering = ['-created_at']

    def get_queryset(self):
        return Alert.objects.filter(user=self.request.user).select_related('person', 'fraction')

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread alerts."""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a single alert as read."""
        alert = self.get_object()
        alert.is_read = True
        alert.save()
        return Response({'message': 'Alerta a fost marcată ca citită.'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all alerts as read."""
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'message': 'Toate alertele au fost marcate ca citite.'})

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate alerts for the current user."""
        count = generate_alerts_for_user(request.user)
        return Response({
            'message': f'{count} alerte au fost generate.',
            'count': count
        })

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get dashboard alert summary."""
        summary = get_dashboard_alert_summary(request.user)
        serializer = AlertDashboardSerializer(summary)
        return Response(serializer.data)
