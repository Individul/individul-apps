from rest_framework import serializers
from django.db.models import Count, Q
from persons.models import ConvictedPerson
from .models import (
    CommissionSession, CommissionEvaluation, CommissionArticleResult,
    Article, ProgramResult, BehaviorResult, Decision,
)


# =============================================================================
# Read Serializers
# =============================================================================

class CommissionArticleResultSerializer(serializers.ModelSerializer):
    """Serializare rezultat articol pentru citire."""
    article_display = serializers.CharField(source='get_article_display', read_only=True)
    program_result_display = serializers.CharField(source='get_program_result_display', read_only=True)
    behavior_result_display = serializers.CharField(source='get_behavior_result_display', read_only=True)
    decision_display = serializers.CharField(source='get_decision_display', read_only=True)

    class Meta:
        model = CommissionArticleResult
        fields = [
            'id', 'article', 'article_display',
            'program_result', 'program_result_display',
            'behavior_result', 'behavior_result_display',
            'decision', 'decision_display',
            'notes',
        ]
        read_only_fields = ['id']


class CommissionEvaluationSerializer(serializers.ModelSerializer):
    """Serializare evaluare per persoana cu articole nested."""
    article_results = CommissionArticleResultSerializer(many=True, read_only=True)
    person = serializers.CharField(source='person_id', read_only=True)
    person_name = serializers.CharField(source='person.full_name', read_only=True)
    person_cnp = serializers.CharField(source='person.cnp', read_only=True)
    articles_count = serializers.SerializerMethodField()

    class Meta:
        model = CommissionEvaluation
        fields = [
            'id', 'person', 'person_name', 'person_cnp',
            'notes', 'articles_count', 'article_results',
        ]
        read_only_fields = ['id']

    def get_articles_count(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'article_results' in obj._prefetched_objects_cache:
            return len(obj.article_results.all())
        return obj.article_results.count()


class CommissionSessionListSerializer(serializers.ModelSerializer):
    """Serializare sedinta pentru lista."""
    evaluations_count = serializers.SerializerMethodField()
    total_articles = serializers.SerializerMethodField()
    art91_count = serializers.SerializerMethodField()
    art91_admis = serializers.SerializerMethodField()
    art91_respins = serializers.SerializerMethodField()
    art92_count = serializers.SerializerMethodField()
    art92_admis = serializers.SerializerMethodField()
    art92_respins = serializers.SerializerMethodField()
    realizat_count = serializers.SerializerMethodField()
    pozitiv_count = serializers.SerializerMethodField()
    admis_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    quarter = serializers.IntegerField(read_only=True)

    class Meta:
        model = CommissionSession
        fields = [
            'id', 'session_date', 'year', 'month', 'quarter',
            'session_number', 'description',
            'evaluations_count', 'total_articles',
            'art91_count', 'art91_admis', 'art91_respins',
            'art92_count', 'art92_admis', 'art92_respins',
            'realizat_count', 'pozitiv_count', 'admis_count',
            'created_by', 'created_by_name', 'created_at',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_evaluations_count(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'evaluations' in obj._prefetched_objects_cache:
            return len(obj.evaluations.all())
        return obj.evaluations.count()

    def get_total_articles(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'evaluations' in obj._prefetched_objects_cache:
            return sum(
                len(e.article_results.all()) if hasattr(e, '_prefetched_objects_cache') and 'article_results' in e._prefetched_objects_cache
                else e.article_results.count()
                for e in obj.evaluations.all()
            )
        return CommissionArticleResult.objects.filter(evaluation__session=obj).count()

    def _count_by_article(self, obj, article_value):
        if hasattr(obj, '_prefetched_objects_cache') and 'evaluations' in obj._prefetched_objects_cache:
            count = 0
            for e in obj.evaluations.all():
                if hasattr(e, '_prefetched_objects_cache') and 'article_results' in e._prefetched_objects_cache:
                    count += sum(1 for ar in e.article_results.all() if ar.article == article_value)
                else:
                    count += e.article_results.filter(article=article_value).count()
            return count
        return CommissionArticleResult.objects.filter(
            evaluation__session=obj, article=article_value
        ).count()

    def _count_by_article_decision(self, obj, article_value, decision_value):
        if hasattr(obj, '_prefetched_objects_cache') and 'evaluations' in obj._prefetched_objects_cache:
            count = 0
            for e in obj.evaluations.all():
                if hasattr(e, '_prefetched_objects_cache') and 'article_results' in e._prefetched_objects_cache:
                    count += sum(1 for ar in e.article_results.all() if ar.article == article_value and ar.decision == decision_value)
                else:
                    count += e.article_results.filter(article=article_value, decision=decision_value).count()
            return count
        return CommissionArticleResult.objects.filter(
            evaluation__session=obj, article=article_value, decision=decision_value
        ).count()

    def get_art91_count(self, obj):
        return self._count_by_article(obj, Article.ART_91)

    def get_art91_admis(self, obj):
        return self._count_by_article_decision(obj, Article.ART_91, Decision.ADMIS)

    def get_art91_respins(self, obj):
        return self._count_by_article_decision(obj, Article.ART_91, Decision.RESPINS)

    def get_art92_count(self, obj):
        return self._count_by_article(obj, Article.ART_92)

    def get_art92_admis(self, obj):
        return self._count_by_article_decision(obj, Article.ART_92, Decision.ADMIS)

    def get_art92_respins(self, obj):
        return self._count_by_article_decision(obj, Article.ART_92, Decision.RESPINS)

    def get_realizat_count(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'evaluations' in obj._prefetched_objects_cache:
            count = 0
            for e in obj.evaluations.all():
                if hasattr(e, '_prefetched_objects_cache') and 'article_results' in e._prefetched_objects_cache:
                    count += sum(1 for ar in e.article_results.all() if ar.program_result == ProgramResult.REALIZAT)
                else:
                    count += e.article_results.filter(program_result=ProgramResult.REALIZAT).count()
            return count
        return CommissionArticleResult.objects.filter(
            evaluation__session=obj, program_result=ProgramResult.REALIZAT
        ).count()

    def get_pozitiv_count(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'evaluations' in obj._prefetched_objects_cache:
            count = 0
            for e in obj.evaluations.all():
                if hasattr(e, '_prefetched_objects_cache') and 'article_results' in e._prefetched_objects_cache:
                    count += sum(1 for ar in e.article_results.all() if ar.behavior_result == BehaviorResult.POZITIV)
                else:
                    count += e.article_results.filter(behavior_result=BehaviorResult.POZITIV).count()
            return count
        return CommissionArticleResult.objects.filter(
            evaluation__session=obj, behavior_result=BehaviorResult.POZITIV
        ).count()

    def get_admis_count(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'evaluations' in obj._prefetched_objects_cache:
            count = 0
            for e in obj.evaluations.all():
                if hasattr(e, '_prefetched_objects_cache') and 'article_results' in e._prefetched_objects_cache:
                    count += sum(1 for ar in e.article_results.all() if ar.decision == Decision.ADMIS)
                else:
                    count += e.article_results.filter(decision=Decision.ADMIS).count()
            return count
        return CommissionArticleResult.objects.filter(
            evaluation__session=obj, decision=Decision.ADMIS
        ).count()


class CommissionSessionDetailSerializer(serializers.ModelSerializer):
    """Serializare sedinta completa cu evaluari si articole nested."""
    evaluations = CommissionEvaluationSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    quarter = serializers.IntegerField(read_only=True)

    class Meta:
        model = CommissionSession
        fields = [
            'id', 'session_date', 'year', 'month', 'quarter',
            'session_number', 'description', 'evaluations',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'year', 'month', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


# =============================================================================
# Input Validators
# =============================================================================

class ArticleResultInputSerializer(serializers.Serializer):
    """Validare input pentru un rezultat articol."""
    article = serializers.ChoiceField(choices=Article.choices)
    program_result = serializers.ChoiceField(choices=ProgramResult.choices)
    behavior_result = serializers.ChoiceField(choices=BehaviorResult.choices)
    decision = serializers.ChoiceField(choices=Decision.choices)
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class EvaluationInputSerializer(serializers.Serializer):
    """Validare input pentru o evaluare (persoana + articole)."""
    person = serializers.UUIDField()
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    article_results = ArticleResultInputSerializer(many=True)

    def validate_person(self, value):
        try:
            ConvictedPerson.objects.get(pk=value)
        except ConvictedPerson.DoesNotExist:
            raise serializers.ValidationError('Persoana nu a fost gasita.')
        return value

    def validate_article_results(self, value):
        if not value:
            raise serializers.ValidationError('Cel putin un articol este necesar.')
        articles = [ar['article'] for ar in value]
        if len(articles) != len(set(articles)):
            raise serializers.ValidationError('Articol duplicat in lista.')
        return value


# =============================================================================
# Create / Update Serializers
# =============================================================================

class CommissionSessionCreateSerializer(serializers.Serializer):
    """Creare sedinta cu evaluari si rezultate articole."""
    session_date = serializers.DateField()
    session_number = serializers.CharField(required=False, allow_blank=True, default='')
    description = serializers.CharField(required=False, allow_blank=True, default='')
    evaluations = EvaluationInputSerializer(many=True)

    def validate_evaluations(self, value):
        if not value:
            raise serializers.ValidationError('Cel putin o evaluare este necesara.')
        persons = [e['person'] for e in value]
        if len(persons) != len(set(persons)):
            raise serializers.ValidationError('Persoana duplicata in lista.')
        return value

    def create(self, validated_data):
        evaluations_data = validated_data.pop('evaluations')
        request = self.context['request']

        session = CommissionSession.objects.create(
            session_date=validated_data['session_date'],
            session_number=validated_data.get('session_number', ''),
            description=validated_data.get('description', ''),
            created_by=request.user,
        )

        for eval_data in evaluations_data:
            article_results_data = eval_data.pop('article_results')
            evaluation = CommissionEvaluation.objects.create(
                session=session,
                person_id=eval_data['person'],
                notes=eval_data.get('notes', ''),
            )
            for ar_data in article_results_data:
                CommissionArticleResult.objects.create(
                    evaluation=evaluation,
                    **ar_data,
                )

        return session


class CommissionSessionUpdateSerializer(serializers.Serializer):
    """Actualizare sedinta (header + inlocuire optionala evaluari)."""
    session_date = serializers.DateField(required=False)
    session_number = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    evaluations = EvaluationInputSerializer(many=True, required=False)

    def validate_evaluations(self, value):
        if value is not None:
            persons = [e['person'] for e in value]
            if len(persons) != len(set(persons)):
                raise serializers.ValidationError('Persoana duplicata in lista.')
        return value

    def update(self, instance, validated_data):
        evaluations_data = validated_data.pop('evaluations', None)

        if 'session_date' in validated_data:
            instance.session_date = validated_data['session_date']
        if 'session_number' in validated_data:
            instance.session_number = validated_data['session_number']
        if 'description' in validated_data:
            instance.description = validated_data['description']
        instance.save()

        if evaluations_data is not None:
            # Inlocuim toate evaluarile (delete cascade + create)
            instance.evaluations.all().delete()
            for eval_data in evaluations_data:
                article_results_data = eval_data.pop('article_results')
                evaluation = CommissionEvaluation.objects.create(
                    session=instance,
                    person_id=eval_data['person'],
                    notes=eval_data.get('notes', ''),
                )
                for ar_data in article_results_data:
                    CommissionArticleResult.objects.create(
                        evaluation=evaluation,
                        **ar_data,
                    )

        return instance
