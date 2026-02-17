from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.utils import timezone

from persons.models import ConvictedPerson
from persons.serializers import ConvictedPersonListSerializer
from accounts.permissions import IsOperatorOrReadOnly
from audit.utils import log_action

from .models import (
    CommissionSession, CommissionEvaluation, CommissionArticleResult,
    Article, ProgramResult, BehaviorResult, Decision,
)
from .serializers import (
    CommissionSessionListSerializer,
    CommissionSessionDetailSerializer,
    CommissionSessionCreateSerializer,
    CommissionSessionUpdateSerializer,
)
from .exports import export_commissions_xlsx, export_commissions_pdf


class CommissionSessionViewSet(viewsets.ModelViewSet):
    queryset = CommissionSession.objects.select_related('created_by').prefetch_related(
        'evaluations__person', 'evaluations__article_results'
    )
    permission_classes = [IsAuthenticated, IsOperatorOrReadOnly]
    filterset_fields = {
        'year': ['exact'],
        'month': ['exact'],
        'session_date': ['exact', 'gte', 'lte'],
    }
    ordering_fields = ['session_date', 'created_at']
    ordering = ['-session_date', '-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(session_number__icontains=search) |
                Q(description__icontains=search) |
                Q(evaluations__person__first_name__icontains=search) |
                Q(evaluations__person__last_name__icontains=search) |
                Q(evaluations__person__cnp__icontains=search)
            ).distinct()
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return CommissionSessionListSerializer
        elif self.action == 'create':
            return CommissionSessionCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return CommissionSessionUpdateSerializer
        return CommissionSessionDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = serializer.save()

        # Refresh cu prefetch pt serializare completa
        session = CommissionSession.objects.select_related('created_by').prefetch_related(
            'evaluations__person', 'evaluations__article_results'
        ).get(pk=session.pk)

        log_action(
            request, 'create', 'CommissionSession', str(session.id),
            after_data=CommissionSessionDetailSerializer(session).data
        )

        return Response(
            CommissionSessionDetailSerializer(session).data,
            status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_data = CommissionSessionDetailSerializer(instance).data

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = serializer.update(instance, serializer.validated_data)

        # Refresh cu prefetch
        session = CommissionSession.objects.select_related('created_by').prefetch_related(
            'evaluations__person', 'evaluations__article_results'
        ).get(pk=session.pk)
        new_data = CommissionSessionDetailSerializer(session).data

        log_action(
            request, 'update', 'CommissionSession', str(session.id),
            before_data=old_data, after_data=new_data
        )

        return Response(new_data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        old_data = CommissionSessionDetailSerializer(instance).data
        sid = str(instance.id)
        instance.delete()
        log_action(
            self.request, 'delete', 'CommissionSession',
            sid, before_data=old_data
        )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Statistici KPI pentru dashboard."""
        now = timezone.now()
        cur_year, cur_month = now.year, now.month

        total_sessions = CommissionSession.objects.filter(year=cur_year, month=cur_month).count()

        cur_articles = CommissionArticleResult.objects.filter(
            evaluation__session__year=cur_year,
            evaluation__session__month=cur_month,
        )
        total_examinations = cur_articles.count()

        # Per article stats
        art91 = cur_articles.filter(article=Article.ART_91)
        art92 = cur_articles.filter(article=Article.ART_92)

        return Response({
            'total_sessions': total_sessions,
            'total_examinations': total_examinations,
            'art91_total': art91.count(),
            'art91_admis': art91.filter(decision=Decision.ADMIS).count(),
            'art91_respins': art91.filter(decision=Decision.RESPINS).count(),
            'art92_total': art92.count(),
            'art92_admis': art92.filter(decision=Decision.ADMIS).count(),
            'art92_respins': art92.filter(decision=Decision.RESPINS).count(),
        })

    @action(detail=False, methods=['get'])
    def monthly_report(self, request):
        """Raport lunar agregate per articol."""
        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))

        articles_qs = CommissionArticleResult.objects.filter(
            evaluation__session__year=year,
            evaluation__session__month=month,
        )

        rows = []
        for art_choice in Article.choices:
            art_value, art_label = art_choice
            art_qs = articles_qs.filter(article=art_value)
            total = art_qs.count()
            rows.append({
                'article': art_value,
                'article_display': art_label,
                'total': total,
                'realizat': art_qs.filter(program_result=ProgramResult.REALIZAT).count(),
                'nerealizat': art_qs.filter(program_result=ProgramResult.NEREALIZAT).count(),
                'nerealizat_independent': art_qs.filter(program_result=ProgramResult.NEREALIZAT_INDEPENDENT).count(),
                'pozitiv': art_qs.filter(behavior_result=BehaviorResult.POZITIV).count(),
                'negativ': art_qs.filter(behavior_result=BehaviorResult.NEGATIV).count(),
                'admis': art_qs.filter(decision=Decision.ADMIS).count(),
                'respins': art_qs.filter(decision=Decision.RESPINS).count(),
            })

        # Totals
        totals = {key: sum(r[key] for r in rows) for key in [
            'total', 'realizat', 'nerealizat', 'nerealizat_independent',
            'pozitiv', 'negativ', 'admis', 'respins',
        ]}

        # Lista sedintelor din luna
        sessions = CommissionSession.objects.filter(
            year=year, month=month
        ).select_related('created_by').prefetch_related(
            'evaluations__person', 'evaluations__article_results'
        ).order_by('session_date')
        sessions_list = CommissionSessionListSerializer(sessions, many=True).data

        return Response({
            'year': year,
            'month': month,
            'articles': rows,
            'totals': totals,
            'sessions': sessions_list,
        })

    @action(detail=False, methods=['get'])
    def quarterly_report(self, request):
        """Raport trimestrial agregate per articol."""
        year = int(request.query_params.get('year', timezone.now().year))
        quarter = int(request.query_params.get('quarter', 1))

        start_month = (quarter - 1) * 3 + 1
        end_month = start_month + 2

        articles_qs = CommissionArticleResult.objects.filter(
            evaluation__session__year=year,
            evaluation__session__month__gte=start_month,
            evaluation__session__month__lte=end_month,
        )

        rows = []
        for art_choice in Article.choices:
            art_value, art_label = art_choice
            art_qs = articles_qs.filter(article=art_value)
            rows.append({
                'article': art_value,
                'article_display': art_label,
                'total': art_qs.count(),
                'realizat': art_qs.filter(program_result=ProgramResult.REALIZAT).count(),
                'nerealizat': art_qs.filter(program_result=ProgramResult.NEREALIZAT).count(),
                'nerealizat_independent': art_qs.filter(program_result=ProgramResult.NEREALIZAT_INDEPENDENT).count(),
                'pozitiv': art_qs.filter(behavior_result=BehaviorResult.POZITIV).count(),
                'negativ': art_qs.filter(behavior_result=BehaviorResult.NEGATIV).count(),
                'admis': art_qs.filter(decision=Decision.ADMIS).count(),
                'respins': art_qs.filter(decision=Decision.RESPINS).count(),
            })

        totals = {key: sum(r[key] for r in rows) for key in [
            'total', 'realizat', 'nerealizat', 'nerealizat_independent',
            'pozitiv', 'negativ', 'admis', 'respins',
        ]}

        return Response({
            'year': year,
            'quarter': quarter,
            'articles': rows,
            'totals': totals,
        })

    @action(detail=False, methods=['get'])
    def export_xlsx(self, request):
        """Export raport comisie in XLSX."""
        year = int(request.query_params.get('year', timezone.now().year))
        month = request.query_params.get('month')
        quarter = request.query_params.get('quarter')

        base_qs = CommissionArticleResult.objects.filter(
            evaluation__session__year=year
        )

        if quarter:
            q = int(quarter)
            start_m = (q - 1) * 3 + 1
            end_m = start_m + 2
            queryset = base_qs.filter(
                evaluation__session__month__gte=start_m,
                evaluation__session__month__lte=end_m,
            )
            return export_commissions_xlsx(queryset, year=year, quarter=q)
        elif month:
            queryset = base_qs.filter(evaluation__session__month=int(month))
            return export_commissions_xlsx(queryset, year=year, month=int(month))
        else:
            return export_commissions_xlsx(base_qs, year=year)

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """Export raport comisie in PDF."""
        year = int(request.query_params.get('year', timezone.now().year))
        month = request.query_params.get('month')
        quarter = request.query_params.get('quarter')

        base_qs = CommissionArticleResult.objects.filter(
            evaluation__session__year=year
        )

        if quarter:
            q = int(quarter)
            start_m = (q - 1) * 3 + 1
            end_m = start_m + 2
            queryset = base_qs.filter(
                evaluation__session__month__gte=start_m,
                evaluation__session__month__lte=end_m,
            )
            return export_commissions_pdf(queryset, year=year, quarter=q)
        elif month:
            queryset = base_qs.filter(evaluation__session__month=int(month))
            return export_commissions_pdf(queryset, year=year, month=int(month))
        else:
            return export_commissions_pdf(base_qs, year=year)

    @action(detail=False, methods=['get'])
    def persons_search(self, request):
        """Cautare persoane pentru dropdown-ul de adaugare."""
        search = request.query_params.get('search', '').strip()
        if len(search) < 2:
            return Response([])

        qs = ConvictedPerson.objects.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(cnp__icontains=search)
        )[:20]

        results = [
            {
                'id': str(p.id),
                'full_name': p.full_name,
                'cnp': p.cnp or '',
            }
            for p in qs
        ]
        return Response(results)

    @action(detail=False, methods=['get'])
    def articles(self, request):
        """Lista articolelor disponibile pentru UI dropdowns."""
        return Response([
            {'value': choice[0], 'label': choice[1]}
            for choice in Article.choices
        ])
