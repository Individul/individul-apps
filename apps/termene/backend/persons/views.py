from uuid import UUID
from datetime import date

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.db.models import Count, Q
from django.utils import timezone
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import io

from .models import ConvictedPerson


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
    ConvictedPersonListSerializer,
    ConvictedPersonDetailSerializer,
    ConvictedPersonCreateSerializer,
    ConvictedPersonUpdateSerializer,
)
from accounts.permissions import IsOperatorOrReadOnly
from audit.models import AuditLog
from audit.middleware import get_current_request
from sentences.models import Sentence


class LargePagePagination(PageNumberPagination):
    page_size = 200


class ConvictedPersonViewSet(viewsets.ModelViewSet):
    queryset = ConvictedPerson.objects.select_related('created_by').prefetch_related(
        'sentences__fractions'
    )
    pagination_class = LargePagePagination
    permission_classes = [IsAuthenticated, IsOperatorOrReadOnly]
    filterset_fields = {
        'admission_date': ['gte', 'lte', 'exact'],
        'mai_notification': ['exact'],
    }
    search_fields = ['first_name', 'last_name', 'cnp']
    ordering_fields = ['last_name', 'first_name', 'admission_date', 'created_at']
    ordering = ['last_name', 'first_name']

    def get_queryset(self):
        return ConvictedPerson.objects.select_related('created_by').prefetch_related(
            'sentences__fractions', 'sentences__reductions', 'sentences__preventive_arrests', 'sentences__zpm_entries'
        )

    def list(self, request, *args, **kwargs):
        """Override list to sort by active_sentence_end_date (soonest first)."""
        response = super().list(request, *args, **kwargs)
        far_future = '9999-12-31'
        response.data['results'] = sorted(
            response.data['results'],
            key=lambda p: str(p.get('active_sentence_end_date') or far_future),
        )
        return response

    def get_serializer_class(self):
        if self.action == 'list':
            return ConvictedPersonListSerializer
        elif self.action == 'create':
            return ConvictedPersonCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ConvictedPersonUpdateSerializer
        return ConvictedPersonDetailSerializer

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        self._log_action('create', instance, None, serializer.data)

    def perform_update(self, serializer):
        before_data = ConvictedPersonDetailSerializer(serializer.instance).data
        instance = serializer.save()
        after_data = ConvictedPersonDetailSerializer(instance).data
        self._log_action('update', instance, before_data, after_data)

    def perform_destroy(self, instance):
        before_data = ConvictedPersonDetailSerializer(instance).data
        self._log_action('delete', instance, before_data, None)
        instance.delete()

    def _log_action(self, action, instance, before_data, after_data):
        request = get_current_request()
        AuditLog.objects.create(
            actor=self.request.user,
            actor_username=self.request.user.username,
            action=action,
            entity_type='ConvictedPerson',
            entity_id=str(instance.id),
            before_json=make_json_serializable(before_data),
            after_json=make_json_serializable(after_data),
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
    def release(self, request, pk=None):
        """Mark person as released and move all active sentences out of active state."""
        person = self.get_object()
        before_data = ConvictedPersonDetailSerializer(person).data

        release_date_raw = request.data.get('release_date')
        if release_date_raw:
            try:
                release_date = date.fromisoformat(str(release_date_raw))
            except ValueError:
                return Response(
                    {'error': 'Data eliberarii trebuie sa fie in format YYYY-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            release_date = timezone.now().date()

        release_type = request.data.get('release_type', '')

        updated_sentences = person.sentences.filter(
            status=Sentence.Status.ACTIVE
        ).update(status=Sentence.Status.FINISHED)

        person.release_date = release_date
        person.release_type = release_type
        person.save(update_fields=['release_date', 'release_type', 'updated_at'])

        # Reload instance to avoid stale prefetched sentence statuses.
        person = self.get_queryset().get(pk=person.pk)

        after_data = ConvictedPersonDetailSerializer(person).data
        self._log_action('release', person, before_data, after_data)

        return Response({
            'message': 'Persoana a fost marcata ca eliberata.',
            'released_date': release_date,
            'updated_sentences': updated_sentences,
            'person': after_data,
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Dashboard statistics."""
        from sentences.models import Fraction
        from django.conf import settings

        today = timezone.now().date()
        imminent_days = getattr(settings, 'FRACTION_IMMINENT_DAYS', 30)
        upcoming_days = getattr(settings, 'FRACTION_UPCOMING_DAYS', 90)

        total_persons = ConvictedPerson.objects.count()
        active_sentences = ConvictedPerson.objects.filter(
            sentences__status='active'
        ).distinct().count()
        released_persons = ConvictedPerson.objects.filter(
            release_date__isnull=False
        ).count()

        # Overdue fractions (before today)
        overdue_count = Fraction.objects.filter(
            sentence__status='active',
            is_fulfilled=False,
            calculated_date__lt=today
        ).count()

        # Imminent fractions (today to 30 days)
        imminent_count = Fraction.objects.filter(
            sentence__status='active',
            is_fulfilled=False,
            calculated_date__gte=today,
            calculated_date__lte=today + timezone.timedelta(days=imminent_days)
        ).count()

        # Upcoming fractions (30-90 days)
        upcoming_count = Fraction.objects.filter(
            sentence__status='active',
            is_fulfilled=False,
            calculated_date__gt=today + timezone.timedelta(days=imminent_days),
            calculated_date__lte=today + timezone.timedelta(days=upcoming_days)
        ).count()

        return Response({
            'total_persons': total_persons,
            'persons_with_active_sentences': active_sentences,
            'released_persons': released_persons,
            'overdue_fractions': overdue_count,
            'imminent_fractions': imminent_count,
            'upcoming_fractions': upcoming_count,
        })

    @action(detail=False, methods=['get'])
    def export_xlsx(self, request):
        """Export persons list to XLSX."""
        queryset = self.filter_queryset(self.get_queryset())

        wb = Workbook()
        ws = wb.active
        ws.title = "Persoane Condamnate"

        # Header
        headers = ['Nume', 'Prenume', 'CNP', 'Data nașterii', 'Data internării', 'Sentințe active', 'Înștiințare MAI']
        ws.append(headers)

        # Data
        for person in queryset:
            ws.append([
                person.last_name,
                person.first_name,
                person.cnp or '',
                person.date_of_birth.strftime('%d.%m.%Y') if person.date_of_birth else '',
                person.admission_date.strftime('%d.%m.%Y') if person.admission_date else '',
                person.active_sentences_count,
                'Da' if person.mai_notification else 'Nu',
            ])

        # Set column widths
        ws.column_dimensions['A'].width = 20
        ws.column_dimensions['B'].width = 20
        ws.column_dimensions['C'].width = 15
        ws.column_dimensions['D'].width = 15
        ws.column_dimensions['E'].width = 15
        ws.column_dimensions['F'].width = 15
        ws.column_dimensions['G'].width = 18

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename=persoane_condamnate.xlsx'
        return response

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """Export persons list to PDF."""
        queryset = self.filter_queryset(self.get_queryset())

        pdfmetrics.registerFont(TTFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuBd', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
        elements = []

        title_style = ParagraphStyle('Title', fontName='DejaVuBd', fontSize=16, spaceAfter=12)
        elements.append(Paragraph("Lista Persoanelor Condamnate", title_style))

        data = [['Nume', 'Prenume', 'CNP', 'Data nașterii', 'Data internării', 'Sentințe', 'Înștiințare MAI']]
        for person in queryset:
            data.append([
                person.last_name,
                person.first_name,
                person.cnp or '',
                person.date_of_birth.strftime('%d.%m.%Y') if person.date_of_birth else '',
                person.admission_date.strftime('%d.%m.%Y') if person.admission_date else '',
                str(person.active_sentences_count),
                'Da' if person.mai_notification else 'Nu',
            ])

        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'DejaVuBd'),
            ('FONTNAME', (0, 1), (-1, -1), 'DejaVu'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(table)

        doc.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename=persoane_condamnate.pdf'
        return response
