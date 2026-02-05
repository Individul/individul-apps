from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.conf import settings

from .models import Sentence, Fraction
from .serializers import (
    SentenceListSerializer,
    SentenceDetailSerializer,
    SentenceCreateSerializer,
    SentenceUpdateSerializer,
    FractionSerializer,
    FractionUpdateSerializer,
    FractionListSerializer,
)
from accounts.permissions import IsOperatorOrReadOnly
from audit.models import AuditLog
from audit.middleware import get_current_request


class SentenceViewSet(viewsets.ModelViewSet):
    queryset = Sentence.objects.select_related('person', 'created_by').prefetch_related('fractions')
    permission_classes = [IsAuthenticated, IsOperatorOrReadOnly]
    filterset_fields = {
        'status': ['exact', 'in'],
        'crime_type': ['exact', 'in'],
        'person': ['exact'],
        'start_date': ['gte', 'lte'],
    }
    search_fields = ['person__first_name', 'person__last_name', 'crime_description']
    ordering_fields = ['start_date', 'created_at', 'status']
    ordering = ['-start_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return SentenceListSerializer
        elif self.action == 'create':
            return SentenceCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return SentenceUpdateSerializer
        return SentenceDetailSerializer

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        self._log_action('create', instance, None, SentenceDetailSerializer(instance).data)

    def perform_update(self, serializer):
        before_data = SentenceDetailSerializer(serializer.instance).data
        instance = serializer.save()
        after_data = SentenceDetailSerializer(instance).data
        self._log_action('update', instance, before_data, after_data)

    def perform_destroy(self, instance):
        before_data = SentenceDetailSerializer(instance).data
        self._log_action('delete', instance, before_data, None)
        instance.delete()

    def _log_action(self, action, instance, before_data, after_data):
        request = get_current_request()
        AuditLog.objects.create(
            actor=self.request.user,
            actor_username=self.request.user.username,
            action=action,
            entity_type='Sentence',
            entity_id=str(instance.id),
            before_json=before_data,
            after_json=after_data,
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '') if request else ''
        )

    def _get_client_ip(self, request):
        if not request:
            return None
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    @action(detail=True, methods=['post'])
    def recalculate(self, request, pk=None):
        """Force recalculate fractions for this sentence."""
        sentence = self.get_object()
        sentence.generate_fractions()
        return Response({
            'message': 'Fracțiile au fost recalculate.',
            'fractions': FractionSerializer(sentence.fractions.all(), many=True).data
        })

    @action(detail=True, methods=['patch'], url_path='fractions/(?P<fraction_id>[^/.]+)')
    def update_fraction(self, request, pk=None, fraction_id=None):
        """Update a specific fraction (mark as fulfilled, add notes)."""
        sentence = self.get_object()
        try:
            fraction = sentence.fractions.get(id=fraction_id)
        except Fraction.DoesNotExist:
            return Response(
                {'error': 'Fracția nu a fost găsită.'},
                status=status.HTTP_404_NOT_FOUND
            )

        before_data = FractionSerializer(fraction).data
        serializer = FractionUpdateSerializer(fraction, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Log the fraction update
        after_data = FractionSerializer(fraction).data
        request_obj = get_current_request()
        AuditLog.objects.create(
            actor=request.user,
            actor_username=request.user.username,
            action='fraction_fulfilled' if fraction.is_fulfilled else 'update',
            entity_type='Fraction',
            entity_id=str(fraction.id),
            before_json=before_data,
            after_json=after_data,
            ip_address=self._get_client_ip(request_obj),
            user_agent=request_obj.META.get('HTTP_USER_AGENT', '') if request_obj else ''
        )

        return Response(FractionSerializer(fraction).data)


class FractionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Fraction.objects.select_related(
        'sentence', 'sentence__person'
    ).filter(sentence__status='active')
    serializer_class = FractionListSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = {
        'fraction_type': ['exact', 'in'],
        'is_fulfilled': ['exact'],
        'calculated_date': ['gte', 'lte'],
    }
    ordering_fields = ['calculated_date']
    ordering = ['calculated_date']

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get fractions due in the next 90 days."""
        today = timezone.now().date()
        upcoming_days = getattr(settings, 'FRACTION_UPCOMING_DAYS', 90)
        end_date = today + timezone.timedelta(days=upcoming_days)

        fractions = self.get_queryset().filter(
            is_fulfilled=False,
            calculated_date__gte=today,
            calculated_date__lte=end_date
        ).order_by('calculated_date')

        page = self.paginate_queryset(fractions)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(fractions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue fractions."""
        today = timezone.now().date()

        fractions = self.get_queryset().filter(
            is_fulfilled=False,
            calculated_date__lt=today
        ).order_by('calculated_date')

        page = self.paginate_queryset(fractions)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(fractions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def imminent(self, request):
        """Get fractions due in the next 30 days."""
        today = timezone.now().date()
        imminent_days = getattr(settings, 'FRACTION_IMMINENT_DAYS', 30)
        end_date = today + timezone.timedelta(days=imminent_days)

        fractions = self.get_queryset().filter(
            is_fulfilled=False,
            calculated_date__gte=today,
            calculated_date__lte=end_date
        ).order_by('calculated_date')

        page = self.paginate_queryset(fractions)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(fractions, many=True)
        return Response(serializer.data)
