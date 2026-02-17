from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from django.utils import timezone

from .models import Transfer, TransferEntry, Penitentiary, OTHER_PENITENTIARIES, ISOLATOR_PENITENTIARIES, ISOLATOR_VALUES
from .serializers import (
    TransferListSerializer,
    TransferDetailSerializer,
    TransferCreateSerializer,
    TransferUpdateSerializer,
)
from .exports import export_transfers_xlsx, export_transfers_pdf
from accounts.permissions import IsOperatorOrReadOnly
from audit.utils import log_action


class TransferViewSet(viewsets.ModelViewSet):
    queryset = Transfer.objects.select_related('created_by').prefetch_related('entries')
    permission_classes = [IsAuthenticated, IsOperatorOrReadOnly]
    filterset_fields = {
        'year': ['exact'],
        'month': ['exact'],
        'transfer_date': ['exact', 'gte', 'lte'],
    }
    ordering_fields = ['transfer_date', 'created_at']
    ordering = ['-transfer_date', '-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return TransferListSerializer
        elif self.action == 'create':
            return TransferCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TransferUpdateSerializer
        return TransferDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transfer = serializer.save()

        # Refresh cu prefetch pt serializare completa
        transfer = Transfer.objects.prefetch_related('entries').get(pk=transfer.pk)

        log_action(
            request, 'create', 'Transfer', str(transfer.id),
            after_data=TransferDetailSerializer(transfer).data
        )

        return Response(
            TransferDetailSerializer(transfer).data,
            status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_data = TransferDetailSerializer(instance).data

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transfer = serializer.update(instance, serializer.validated_data)

        # Refresh cu prefetch
        transfer = Transfer.objects.prefetch_related('entries').get(pk=transfer.pk)
        new_data = TransferDetailSerializer(transfer).data

        log_action(
            request, 'update', 'Transfer', str(transfer.id),
            before_data=old_data, after_data=new_data
        )

        return Response(new_data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        old_data = TransferDetailSerializer(instance).data
        tid = str(instance.id)
        instance.delete()
        log_action(
            self.request, 'delete', 'Transfer',
            tid, before_data=old_data
        )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Statistici KPI pentru dashboard."""
        now = timezone.now()
        cur_year, cur_month = now.year, now.month

        if cur_month == 1:
            prev_year, prev_month = cur_year - 1, 12
        else:
            prev_year, prev_month = cur_year, cur_month - 1

        cur = TransferEntry.objects.filter(
            transfer__year=cur_year, transfer__month=cur_month
        ).aggregate(total_veniti=Sum('veniti'), total_plecati=Sum('plecati'))

        prev = TransferEntry.objects.filter(
            transfer__year=prev_year, transfer__month=prev_month
        ).aggregate(total_veniti=Sum('veniti'), total_plecati=Sum('plecati'))

        cv = cur['total_veniti'] or 0
        cp = cur['total_plecati'] or 0
        pv = prev['total_veniti'] or 0
        pp = prev['total_plecati'] or 0

        transfers_count = Transfer.objects.count()

        return Response({
            'current_month_veniti': cv,
            'current_month_plecati': cp,
            'current_month_net': cv - cp,
            'previous_month_veniti': pv,
            'previous_month_plecati': pp,
            'total_transfers': transfers_count,
        })

    @action(detail=False, methods=['get'])
    def monthly_report(self, request):
        """Raport lunar complet cu totaluri agregate din toate transferurile."""
        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))

        # Agregate per penitenciar (din toate transferurile lunii)
        rows = TransferEntry.objects.filter(
            transfer__year=year, transfer__month=month
        ).values('penitentiary').annotate(
            total_veniti=Sum('veniti'),
            total_veniti_reintorsi=Sum('veniti_reintorsi'),
            total_veniti_noi=Sum('veniti_noi'),
            total_plecati=Sum('plecati'),
            total_plecati_izolator=Sum('plecati_izolator'),
        ).order_by('penitentiary')

        entries = []
        for row in rows:
            pen_val = row['penitentiary']
            entries.append({
                'penitentiary': pen_val,
                'penitentiary_display': Penitentiary(pen_val).label,
                'is_isolator': pen_val in ISOLATOR_VALUES,
                'veniti': row['total_veniti'] or 0,
                'veniti_reintorsi': row['total_veniti_reintorsi'] or 0,
                'veniti_noi': row['total_veniti_noi'] or 0,
                'plecati': row['total_plecati'] or 0,
                'plecati_izolator': row['total_plecati_izolator'] or 0,
            })

        totals = {
            'total_veniti': sum(e['veniti'] for e in entries),
            'total_veniti_reintorsi': sum(e['veniti_reintorsi'] for e in entries),
            'total_veniti_noi': sum(e['veniti_noi'] for e in entries),
            'total_plecati': sum(e['plecati'] for e in entries),
            'total_plecati_izolator': sum(e['plecati_izolator'] for e in entries),
        }

        # Lista transferurilor individuale din luna
        transfers_in_month = Transfer.objects.filter(
            year=year, month=month
        ).select_related('created_by').prefetch_related('entries').order_by('transfer_date')
        transfers_list = TransferListSerializer(transfers_in_month, many=True).data

        return Response({
            'year': year,
            'month': month,
            'entries': entries,
            'totals': totals,
            'transfers': transfers_list,
        })

    @action(detail=False, methods=['get'])
    def quarterly_report(self, request):
        """Raport trimestrial agregat."""
        year = int(request.query_params.get('year', timezone.now().year))
        quarter = int(request.query_params.get('quarter', 1))

        start_month = (quarter - 1) * 3 + 1
        end_month = start_month + 2

        rows = TransferEntry.objects.filter(
            transfer__year=year,
            transfer__month__gte=start_month,
            transfer__month__lte=end_month
        ).values('penitentiary').annotate(
            total_veniti=Sum('veniti'),
            total_veniti_reintorsi=Sum('veniti_reintorsi'),
            total_veniti_noi=Sum('veniti_noi'),
            total_plecati=Sum('plecati'),
            total_plecati_izolator=Sum('plecati_izolator'),
        ).order_by('penitentiary')

        result = []
        for row in rows:
            pen_val = row['penitentiary']
            result.append({
                'penitentiary': pen_val,
                'penitentiary_display': Penitentiary(pen_val).label,
                'is_isolator': pen_val in ISOLATOR_VALUES,
                'total_veniti': row['total_veniti'] or 0,
                'total_veniti_reintorsi': row['total_veniti_reintorsi'] or 0,
                'total_veniti_noi': row['total_veniti_noi'] or 0,
                'total_plecati': row['total_plecati'] or 0,
                'total_plecati_izolator': row['total_plecati_izolator'] or 0,
            })

        grand = {
            'total_veniti': sum(r['total_veniti'] for r in result),
            'total_veniti_reintorsi': sum(r['total_veniti_reintorsi'] for r in result),
            'total_veniti_noi': sum(r['total_veniti_noi'] for r in result),
            'total_plecati': sum(r['total_plecati'] for r in result),
            'total_plecati_izolator': sum(r['total_plecati_izolator'] for r in result),
        }

        return Response({
            'year': year,
            'quarter': quarter,
            'entries': result,
            'totals': grand,
        })

    @action(detail=False, methods=['get'])
    def export_xlsx(self, request):
        """Export raport transferuri in XLSX."""
        year = int(request.query_params.get('year', timezone.now().year))
        month = request.query_params.get('month')
        quarter = request.query_params.get('quarter')

        base_qs = TransferEntry.objects.filter(transfer__year=year)

        if quarter:
            q = int(quarter)
            start_m = (q - 1) * 3 + 1
            end_m = start_m + 2
            queryset = base_qs.filter(transfer__month__gte=start_m, transfer__month__lte=end_m)
            return export_transfers_xlsx(queryset, year=year, quarter=q)
        elif month:
            queryset = base_qs.filter(transfer__month=int(month))
            return export_transfers_xlsx(queryset, year=year, month=int(month))
        else:
            return export_transfers_xlsx(base_qs, year=year)

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """Export raport transferuri in PDF."""
        year = int(request.query_params.get('year', timezone.now().year))
        month = request.query_params.get('month')
        quarter = request.query_params.get('quarter')

        base_qs = TransferEntry.objects.filter(transfer__year=year)

        if quarter:
            q = int(quarter)
            start_m = (q - 1) * 3 + 1
            end_m = start_m + 2
            queryset = base_qs.filter(transfer__month__gte=start_m, transfer__month__lte=end_m)
            return export_transfers_pdf(queryset, year=year, quarter=q)
        elif month:
            queryset = base_qs.filter(transfer__month=int(month))
            return export_transfers_pdf(queryset, year=year, month=int(month))
        else:
            return export_transfers_pdf(base_qs, year=year)

    @action(detail=False, methods=['get'])
    def penitentiaries(self, request):
        """Lista penitenciarelor pentru dropdown-uri UI."""
        result = [
            {
                'value': p.value,
                'label': p.label,
                'is_isolator': p in ISOLATOR_PENITENTIARIES,
            }
            for p in OTHER_PENITENTIARIES
        ]
        return Response(result)
