from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.db.models import Count, Q
from django.utils import timezone
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
import io

from .models import ConvictedPerson
from .serializers import (
    ConvictedPersonListSerializer,
    ConvictedPersonDetailSerializer,
    ConvictedPersonCreateSerializer,
    ConvictedPersonUpdateSerializer,
)
from accounts.permissions import IsOperatorOrReadOnly
from audit.models import AuditLog
from audit.middleware import get_current_request


class ConvictedPersonViewSet(viewsets.ModelViewSet):
    queryset = ConvictedPerson.objects.select_related('created_by').prefetch_related(
        'sentences__fractions'
    )
    permission_classes = [IsAuthenticated, IsOperatorOrReadOnly]
    filterset_fields = {
        'admission_date': ['gte', 'lte', 'exact'],
    }
    search_fields = ['first_name', 'last_name', 'cnp']
    ordering_fields = ['last_name', 'first_name', 'admission_date', 'created_at']
    ordering = ['last_name', 'first_name']

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
        headers = ['Nume', 'Prenume', 'CNP', 'Data nașterii', 'Data internării', 'Sentințe active']
        ws.append(headers)

        # Data
        for person in queryset:
            ws.append([
                person.last_name,
                person.first_name,
                person.cnp,
                person.date_of_birth.strftime('%d.%m.%Y'),
                person.admission_date.strftime('%d.%m.%Y'),
                person.active_sentences_count
            ])

        # Set column widths
        ws.column_dimensions['A'].width = 20
        ws.column_dimensions['B'].width = 20
        ws.column_dimensions['C'].width = 15
        ws.column_dimensions['D'].width = 15
        ws.column_dimensions['E'].width = 15
        ws.column_dimensions['F'].width = 15

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

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
        elements = []
        styles = getSampleStyleSheet()

        elements.append(Paragraph("Lista Persoanelor Condamnate", styles['Heading1']))

        data = [['Nume', 'Prenume', 'CNP', 'Data nașterii', 'Data internării', 'Sentințe']]
        for person in queryset:
            data.append([
                person.last_name,
                person.first_name,
                person.cnp,
                person.date_of_birth.strftime('%d.%m.%Y'),
                person.admission_date.strftime('%d.%m.%Y'),
                str(person.active_sentences_count)
            ])

        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
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
