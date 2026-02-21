import json
from uuid import UUID

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.conf import settings

from .models import Sentence, Fraction, SentenceReduction, PreventiveArrest, ZPM


def make_json_serializable(obj):
    """Convert an object to be JSON serializable (handle UUIDs, dates, etc.)."""
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(item) for item in obj]
    elif isinstance(obj, UUID):
        return str(obj)
    return obj
from .serializers import (
    SentenceListSerializer,
    SentenceDetailSerializer,
    SentenceCreateSerializer,
    SentenceUpdateSerializer,
    FractionSerializer,
    FractionUpdateSerializer,
    FractionListSerializer,
    SentenceReductionSerializer,
    PreventiveArrestSerializer,
    ZPMSerializer,
)
from accounts.permissions import IsOperatorOrReadOnly
from audit.models import AuditLog
from audit.middleware import get_current_request


class SentenceViewSet(viewsets.ModelViewSet):
    queryset = Sentence.objects.select_related('person', 'created_by').prefetch_related('fractions', 'reductions', 'preventive_arrests', 'zpm_entries')
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
            before_json=make_json_serializable(before_data) if before_data else None,
            after_json=make_json_serializable(after_data) if after_data else None,
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

        before_data = make_json_serializable(FractionSerializer(fraction).data)
        serializer = FractionUpdateSerializer(fraction, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Log the fraction update
        after_data = make_json_serializable(FractionSerializer(fraction).data)
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

    @action(detail=True, methods=['post'], url_path='reductions')
    def add_reduction(self, request, pk=None):
        """Adaugă o reducere de pedeapsă."""
        sentence = self.get_object()

        serializer = SentenceReductionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Verificăm că reducerea nu depășește durata rămasă
        reduction_total = (
            serializer.validated_data.get('reduction_years', 0) * 365 +
            serializer.validated_data.get('reduction_months', 0) * 30 +
            serializer.validated_data.get('reduction_days', 0)
        )

        current_effective = sentence.total_days - sentence.total_reduction_days
        if reduction_total >= current_effective:
            return Response(
                {'error': 'Reducerea nu poate depăși durata efectivă rămasă.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reduction = serializer.save(sentence=sentence, created_by=request.user)

        # Recalculăm fracțiile cu durata efectivă
        sentence.generate_fractions()

        # Audit log
        self._log_reduction_action('add_reduction', sentence, reduction)

        return Response(SentenceReductionSerializer(reduction).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='reductions/(?P<reduction_id>[^/.]+)')
    def delete_reduction(self, request, pk=None, reduction_id=None):
        """Șterge o reducere de pedeapsă."""
        sentence = self.get_object()
        try:
            reduction = sentence.reductions.get(id=reduction_id)
        except SentenceReduction.DoesNotExist:
            return Response(
                {'error': 'Reducerea nu a fost găsită.'},
                status=status.HTTP_404_NOT_FOUND
            )

        self._log_reduction_action('delete_reduction', sentence, reduction)
        reduction.delete()

        # Recalculăm fracțiile
        sentence.generate_fractions()

        return Response(status=status.HTTP_204_NO_CONTENT)

    def _log_reduction_action(self, action, sentence, reduction):
        """Log reduction actions to audit log."""
        request = get_current_request()
        reduction_data = make_json_serializable(SentenceReductionSerializer(reduction).data)

        AuditLog.objects.create(
            actor=self.request.user,
            actor_username=self.request.user.username,
            action=action,
            entity_type='SentenceReduction',
            entity_id=str(reduction.id),
            before_json=reduction_data if action == 'delete_reduction' else None,
            after_json=reduction_data if action == 'add_reduction' else None,
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '') if request else ''
        )

    @action(detail=True, methods=['post'], url_path='preventive-arrests')
    def add_preventive_arrest(self, request, pk=None):
        """Adaugă o perioadă de arest preventiv."""
        sentence = self.get_object()

        serializer = PreventiveArrestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Calculăm zilele noii perioade
        start = serializer.validated_data['start_date']
        end = serializer.validated_data['end_date']
        new_days = (end - start).days

        # Verificăm că nu depășește durata efectivă rămasă
        current_effective = sentence.total_days - sentence.total_reduction_days - sentence.total_preventive_arrest_days
        if new_days >= current_effective:
            return Response(
                {'error': 'Perioada de arest preventiv nu poate depăși durata efectivă rămasă.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pa = serializer.save(sentence=sentence, created_by=request.user)

        # Recalculăm fracțiile
        sentence.generate_fractions()

        # Audit log
        self._log_preventive_arrest_action('add_preventive_arrest', sentence, pa)

        return Response(PreventiveArrestSerializer(pa).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='preventive-arrests/(?P<pa_id>[^/.]+)/update')
    def update_preventive_arrest(self, request, pk=None, pa_id=None):
        """Editează o perioadă de arest preventiv."""
        sentence = self.get_object()
        try:
            pa = sentence.preventive_arrests.get(id=pa_id)
        except PreventiveArrest.DoesNotExist:
            return Response(
                {'error': 'Perioada de arest preventiv nu a fost găsită.'},
                status=status.HTTP_404_NOT_FOUND
            )

        before_data = make_json_serializable(PreventiveArrestSerializer(pa).data)
        serializer = PreventiveArrestSerializer(pa, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Calculăm zilele noii perioade
        start = serializer.validated_data.get('start_date', pa.start_date)
        end = serializer.validated_data.get('end_date', pa.end_date)
        new_days = (end - start).days

        # Verificăm că nu depășește durata efectivă rămasă (excluzând PA curentă)
        current_effective = sentence.total_days - sentence.total_reduction_days - sentence.total_preventive_arrest_days + pa.days
        if new_days >= current_effective:
            return Response(
                {'error': 'Perioada de arest preventiv nu poate depăși durata efectivă rămasă.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer.save()

        # Recalculăm fracțiile
        sentence.generate_fractions()

        # Audit log
        after_data = make_json_serializable(PreventiveArrestSerializer(pa).data)
        request_obj = get_current_request()
        AuditLog.objects.create(
            actor=request.user,
            actor_username=request.user.username,
            action='update',
            entity_type='PreventiveArrest',
            entity_id=str(pa.id),
            before_json=before_data,
            after_json=after_data,
            ip_address=self._get_client_ip(request_obj),
            user_agent=request_obj.META.get('HTTP_USER_AGENT', '') if request_obj else ''
        )

        return Response(PreventiveArrestSerializer(pa).data)

    @action(detail=True, methods=['delete'], url_path='preventive-arrests/(?P<pa_id>[^/.]+)')
    def delete_preventive_arrest(self, request, pk=None, pa_id=None):
        """Șterge o perioadă de arest preventiv."""
        sentence = self.get_object()
        try:
            pa = sentence.preventive_arrests.get(id=pa_id)
        except PreventiveArrest.DoesNotExist:
            return Response(
                {'error': 'Perioada de arest preventiv nu a fost găsită.'},
                status=status.HTTP_404_NOT_FOUND
            )

        self._log_preventive_arrest_action('delete_preventive_arrest', sentence, pa)
        pa.delete()

        # Recalculăm fracțiile
        sentence.generate_fractions()

        return Response(status=status.HTTP_204_NO_CONTENT)

    def _log_preventive_arrest_action(self, action, sentence, pa):
        """Log preventive arrest actions to audit log."""
        request = get_current_request()
        pa_data = make_json_serializable(PreventiveArrestSerializer(pa).data)

        AuditLog.objects.create(
            actor=self.request.user,
            actor_username=self.request.user.username,
            action=action,
            entity_type='PreventiveArrest',
            entity_id=str(pa.id),
            before_json=pa_data if action == 'delete_preventive_arrest' else None,
            after_json=pa_data if action == 'add_preventive_arrest' else None,
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '') if request else ''
        )

    @action(detail=True, methods=['post'], url_path='zpm')
    def add_zpm(self, request, pk=None):
        """Adaugă o înregistrare ZPM."""
        sentence = self.get_object()

        serializer = ZPMSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Verificăm că nu există deja o înregistrare pentru luna/anul respectiv
        month = serializer.validated_data['month']
        year = serializer.validated_data['year']
        if sentence.zpm_entries.filter(month=month, year=year).exists():
            return Response(
                {'error': f'Există deja o înregistrare ZPM pentru {month:02d}/{year}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        zpm = serializer.save(sentence=sentence, created_by=request.user)

        # Recalculăm fracțiile
        sentence.generate_fractions()

        # Audit log
        self._log_zpm_action('add_zpm', sentence, zpm)

        return Response(ZPMSerializer(zpm).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='zpm/(?P<zpm_id>[^/.]+)')
    def delete_zpm(self, request, pk=None, zpm_id=None):
        """Șterge o înregistrare ZPM."""
        sentence = self.get_object()
        try:
            zpm = sentence.zpm_entries.get(id=zpm_id)
        except ZPM.DoesNotExist:
            return Response(
                {'error': 'Înregistrarea ZPM nu a fost găsită.'},
                status=status.HTTP_404_NOT_FOUND
            )

        self._log_zpm_action('delete_zpm', sentence, zpm)
        zpm.delete()

        # Recalculăm fracțiile
        sentence.generate_fractions()

        return Response(status=status.HTTP_204_NO_CONTENT)

    def _log_zpm_action(self, action, sentence, zpm):
        """Log ZPM actions to audit log."""
        request = get_current_request()
        zpm_data = make_json_serializable(ZPMSerializer(zpm).data)

        AuditLog.objects.create(
            actor=self.request.user,
            actor_username=self.request.user.username,
            action=action,
            entity_type='ZPM',
            entity_id=str(zpm.id),
            before_json=zpm_data if action == 'delete_zpm' else None,
            after_json=zpm_data if action == 'add_zpm' else None,
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '') if request else ''
        )


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
