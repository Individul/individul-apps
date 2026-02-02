from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Count, Q
from django.utils import timezone
from django.http import HttpResponse
from django.conf import settings
import mimetypes

from .models import Petition, PetitionAttachment
from .serializers import (
    PetitionListSerializer,
    PetitionDetailSerializer,
    PetitionCreateSerializer,
    PetitionUpdateSerializer,
    PetitionAttachmentSerializer,
    PetitionStatsSerializer,
)
from .exports import export_petitions_xlsx, export_petitions_pdf
from accounts.permissions import IsOperatorOrReadOnly
from audit.utils import log_action


class PetitionViewSet(viewsets.ModelViewSet):
    queryset = Petition.objects.select_related('assigned_to', 'created_by').prefetch_related('attachments')
    permission_classes = [IsAuthenticated, IsOperatorOrReadOnly]
    filterset_fields = {
        'status': ['exact', 'in'],
        'petitioner_type': ['exact', 'in'],
        'object_type': ['exact', 'in'],
        'assigned_to': ['exact', 'isnull'],
        'registration_date': ['gte', 'lte', 'exact'],
        'registration_year': ['exact'],
    }
    search_fields = ['petitioner_name', 'detainee_fullname', 'registration_seq', 'object_description']
    ordering_fields = ['registration_date', 'registration_seq', 'status', 'created_at']
    ordering = ['-registration_date', '-registration_seq']

    def get_serializer_class(self):
        if self.action == 'list':
            return PetitionListSerializer
        elif self.action == 'create':
            return PetitionCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return PetitionUpdateSerializer
        return PetitionDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by due status
        due_filter = self.request.query_params.get('due_filter')
        if due_filter == 'due_soon':
            days = getattr(settings, 'PETITION_DUE_SOON_DAYS', 3)
            due_date = timezone.now().date() + timezone.timedelta(days=days)
            queryset = queryset.filter(
                registration_date__lte=due_date - timezone.timedelta(days=getattr(settings, 'PETITION_RESPONSE_DAYS', 12) - days)
            ).exclude(status=Petition.Status.SOLUTIONATA)
        elif due_filter == 'overdue':
            due_date = timezone.now().date() - timezone.timedelta(days=getattr(settings, 'PETITION_RESPONSE_DAYS', 12))
            queryset = queryset.filter(
                registration_date__lte=due_date
            ).exclude(status=Petition.Status.SOLUTIONATA)

        return queryset

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(
            self.request,
            'create',
            'Petition',
            str(instance.id),
            after_data=PetitionDetailSerializer(instance).data
        )

    def perform_update(self, serializer):
        old_data = PetitionDetailSerializer(serializer.instance).data
        old_status = serializer.instance.status
        instance = serializer.save()
        new_data = PetitionDetailSerializer(instance).data

        action_type = 'status_change' if old_status != instance.status else 'update'
        log_action(
            self.request,
            action_type,
            'Petition',
            str(instance.id),
            before_data=old_data,
            after_data=new_data
        )

    def perform_destroy(self, instance):
        old_data = PetitionDetailSerializer(instance).data
        petition_id = str(instance.id)
        instance.delete()
        log_action(
            self.request,
            'delete',
            'Petition',
            petition_id,
            before_data=old_data
        )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get petition statistics for dashboard."""
        queryset = self.get_queryset()

        # Total count
        total = queryset.count()

        # Count by status
        by_status = dict(queryset.values('status').annotate(count=Count('id')).values_list('status', 'count'))

        # Calculate due soon and overdue
        today = timezone.now().date()
        response_days = getattr(settings, 'PETITION_RESPONSE_DAYS', 12)
        due_soon_days = getattr(settings, 'PETITION_DUE_SOON_DAYS', 3)

        # Due soon: within 3 days but not overdue
        due_soon_boundary = today + timezone.timedelta(days=due_soon_days)
        due_soon = queryset.exclude(
            status=Petition.Status.SOLUTIONATA
        ).filter(
            registration_date__gt=today - timezone.timedelta(days=response_days),
            registration_date__lte=due_soon_boundary - timezone.timedelta(days=response_days)
        ).count()

        # Overdue: past due date
        overdue_boundary = today - timezone.timedelta(days=response_days)
        overdue = queryset.exclude(
            status=Petition.Status.SOLUTIONATA
        ).filter(
            registration_date__lte=overdue_boundary
        ).count()

        # Count by object type
        by_object_type = dict(
            queryset.values('object_type').annotate(count=Count('id')).values_list('object_type', 'count')
        )

        # Count by petitioner type
        by_petitioner_type = dict(
            queryset.values('petitioner_type').annotate(count=Count('id')).values_list('petitioner_type', 'count')
        )

        data = {
            'total': total,
            'by_status': by_status,
            'due_soon': due_soon,
            'overdue': overdue,
            'by_object_type': by_object_type,
            'by_petitioner_type': by_petitioner_type,
        }

        serializer = PetitionStatsSerializer(data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def export_xlsx(self, request):
        """Export filtered petitions to XLSX."""
        queryset = self.filter_queryset(self.get_queryset())
        response = export_petitions_xlsx(queryset)
        return response

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """Export filtered petitions to PDF."""
        queryset = self.filter_queryset(self.get_queryset())
        response = export_petitions_pdf(queryset)
        return response

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_attachment(self, request, pk=None):
        """Upload attachment to petition."""
        petition = self.get_object()
        file = request.FILES.get('file')

        if not file:
            return Response({'error': 'Nu a fost furnizat niciun fișier.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate file
        max_size = getattr(settings, 'MAX_UPLOAD_SIZE', 20 * 1024 * 1024)
        if file.size > max_size:
            return Response(
                {'error': f'Fișierul este prea mare. Dimensiunea maximă permisă este {max_size // (1024*1024)} MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        allowed_extensions = getattr(settings, 'ALLOWED_UPLOAD_EXTENSIONS', ['.pdf', '.jpg', '.jpeg', '.png'])
        ext = '.' + file.name.split('.')[-1].lower()
        if ext not in allowed_extensions:
            return Response(
                {'error': f'Tip de fișier nepermis. Extensii acceptate: {", ".join(allowed_extensions)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        content_type = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'

        attachment = PetitionAttachment.objects.create(
            petition=petition,
            file=file,
            original_filename=file.name,
            size_bytes=file.size,
            content_type=content_type,
            uploaded_by=request.user
        )

        log_action(
            request,
            'upload',
            'PetitionAttachment',
            str(attachment.id),
            after_data={
                'petition_id': str(petition.id),
                'filename': file.name,
                'size': file.size
            }
        )

        serializer = PetitionAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='attachments/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        """Delete attachment from petition."""
        petition = self.get_object()
        try:
            attachment = petition.attachments.get(id=attachment_id)
        except PetitionAttachment.DoesNotExist:
            return Response({'error': 'Fișierul nu a fost găsit.'}, status=status.HTTP_404_NOT_FOUND)

        old_data = {
            'petition_id': str(petition.id),
            'filename': attachment.original_filename,
            'size': attachment.size_bytes
        }

        attachment.delete()

        log_action(
            request,
            'delete',
            'PetitionAttachment',
            attachment_id,
            before_data=old_data
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class AttachmentDownloadView(generics.RetrieveAPIView):
    """Download attachment file."""
    queryset = PetitionAttachment.objects.all()
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        attachment = self.get_object()
        response = HttpResponse(attachment.file, content_type=attachment.content_type)
        response['Content-Disposition'] = f'attachment; filename="{attachment.original_filename}"'
        return response
