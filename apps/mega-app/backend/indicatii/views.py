from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, CharFilter, DateFilter
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q
from accounts.permissions import IsOperatorOrReadOnly
from .models import Indicatie, IndicatieDestinatari, IndicatieComentariu, IndicatieFisier, SablonIndicatie
from .serializers import (
    IndicatieListSerializer, IndicatieDetailSerializer,
    ComentariuSerializer, FisierSerializer, DestinatarSerializer,
    SablonSerializer, BulkCreateSerializer
)
from persons.models import ConvictedPerson

User = get_user_model()


class IndicatieFilter(FilterSet):
    termen_from = DateFilter(field_name='termen_limita', lookup_expr='gte')
    termen_to = DateFilter(field_name='termen_limita', lookup_expr='lte')
    destinatar = CharFilter(method='filter_destinatar')
    status_destinatar = CharFilter(method='filter_status_destinatar')

    class Meta:
        model = Indicatie
        fields = ['prioritate', 'created_by', 'persoana_legata', 'termen_from', 'termen_to', 'destinatar', 'status_destinatar']

    def filter_destinatar(self, queryset, name, value):
        if value:
            return queryset.filter(destinatari__destinatar_id=value)
        return queryset

    def filter_status_destinatar(self, queryset, name, value):
        if value:
            return queryset.filter(destinatari__status=value)
        return queryset


class IndicatieViewSet(viewsets.ModelViewSet):
    serializer_class = IndicatieListSerializer
    permission_classes = [IsAuthenticated, IsOperatorOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_class = IndicatieFilter
    ordering_fields = ['termen_limita', 'prioritate', 'created_at']
    ordering = ['-created_at']
    search_fields = ['titlu', 'descriere']
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        # User sees indicatii they created OR are assigned to
        return Indicatie.objects.filter(
            Q(created_by=user) | Q(destinatari__destinatar=user)
        ).distinct().select_related('created_by', 'persoana_legata').prefetch_related('destinatari__destinatar')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return IndicatieDetailSerializer
        return IndicatieListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def comentarii(self, request, pk=None):
        indicatie = self.get_object()
        text = request.data.get('text', '')
        if not text.strip():
            return Response({'error': 'Comentariul nu poate fi gol.'}, status=status.HTTP_400_BAD_REQUEST)
        comentariu = IndicatieComentariu.objects.create(
            indicatie=indicatie, autor=request.user, text=text.strip()
        )
        return Response(ComentariuSerializer(comentariu).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def lista_comentarii(self, request, pk=None):
        indicatie = self.get_object()
        comentarii = indicatie.comentarii.all()
        return Response(ComentariuSerializer(comentarii, many=True).data)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def fisiere(self, request, pk=None):
        indicatie = self.get_object()
        fisier = request.FILES.get('fisier')
        if not fisier:
            return Response({'error': 'Fișierul este obligatoriu.'}, status=status.HTTP_400_BAD_REQUEST)
        obj = IndicatieFisier.objects.create(
            indicatie=indicatie, uploaded_by=request.user,
            fisier=fisier, nume_fisier=fisier.name
        )
        return Response(FisierSerializer(obj).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def lista_fisiere(self, request, pk=None):
        indicatie = self.get_object()
        fisiere = indicatie.fisiere.all()
        return Response(FisierSerializer(fisiere, many=True).data)

    @action(detail=True, methods=['delete'], url_path='fisiere/(?P<fisier_id>[^/.]+)')
    def sterge_fisier(self, request, pk=None, fisier_id=None):
        indicatie = self.get_object()
        try:
            fisier = indicatie.fisiere.get(id=fisier_id)
            # Only uploader or admin can delete
            if fisier.uploaded_by != request.user and not request.user.is_admin:
                return Response({'error': 'Nu aveți permisiunea.'}, status=status.HTTP_403_FORBIDDEN)
            fisier.fisier.delete()  # delete file from disk
            fisier.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except IndicatieFisier.DoesNotExist:
            return Response({'error': 'Fișierul nu a fost găsit.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        """Destinatar updates their individual status"""
        indicatie = self.get_object()
        new_status = request.data.get('status')
        if new_status not in [c[0] for c in IndicatieDestinatari.Status.choices]:
            return Response({'error': 'Status invalid.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dest = indicatie.destinatari.get(destinatar=request.user)
        except IndicatieDestinatari.DoesNotExist:
            return Response({'error': 'Nu sunteți destinatarul acestei indicații.'}, status=status.HTTP_403_FORBIDDEN)

        dest.status = new_status
        if new_status == IndicatieDestinatari.Status.INDEPLINIT:
            dest.data_indeplinire = timezone.now()
        else:
            dest.data_indeplinire = None
        dest.save()
        return Response(DestinatarSerializer(dest).data)

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk_create(self, request):
        """Create one indicatie per person in persoane_ids, all with same params."""
        serializer = BulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        persoane = ConvictedPerson.objects.filter(id__in=data['persoane_ids'])
        if persoane.count() != len(data['persoane_ids']):
            return Response(
                {'error': 'Una sau mai multe persoane nu au fost găsite.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created = []
        for persoana in persoane:
            indicatie = Indicatie.objects.create(
                titlu=data['titlu'],
                descriere=data['descriere'],
                prioritate=data['prioritate'],
                instanta=data.get('instanta', ''),
                tip_hotarire=data.get('tip_hotarire', ''),
                data_hotarire=data.get('data_hotarire'),
                termen_limita=data['termen_limita'],
                persoana_legata=persoana,
                created_by=request.user,
            )
            for user_id in data['destinatari_ids']:
                IndicatieDestinatari.objects.create(
                    indicatie=indicatie, destinatar_id=user_id
                )
            created.append(indicatie)

        return Response(
            IndicatieListSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED
        )


class SablonViewSet(viewsets.ModelViewSet):
    serializer_class = SablonSerializer
    permission_classes = [IsAuthenticated, IsOperatorOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        return SablonIndicatie.objects.all().select_related('created_by').prefetch_related('destinatari_default')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
