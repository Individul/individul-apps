from rest_framework import serializers
from .models import Sentence, Fraction, SentenceReduction, PreventiveArrest, ZPM


class FractionSerializer(serializers.ModelSerializer):
    days_until = serializers.IntegerField(read_only=True)
    alert_status = serializers.CharField(read_only=True)
    fraction_type_display = serializers.CharField(source='get_fraction_type_display', read_only=True)

    class Meta:
        model = Fraction
        fields = [
            'id', 'sentence', 'fraction_type', 'fraction_type_display',
            'calculated_date', 'is_fulfilled', 'fulfilled_date',
            'description', 'notes', 'days_until', 'alert_status',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'sentence', 'fraction_type', 'calculated_date', 'created_at', 'updated_at']


class FractionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fraction
        fields = ['is_fulfilled', 'fulfilled_date', 'notes']


class FractionListSerializer(serializers.ModelSerializer):
    days_until = serializers.IntegerField(read_only=True)
    alert_status = serializers.CharField(read_only=True)
    person_id = serializers.UUIDField(source='sentence.person.id', read_only=True)
    person_name = serializers.CharField(source='sentence.person.full_name', read_only=True)
    crime_type = serializers.CharField(source='sentence.crime_type', read_only=True)
    crime_type_display = serializers.CharField(source='sentence.get_crime_type_display', read_only=True)

    class Meta:
        model = Fraction
        fields = [
            'id', 'sentence', 'person_id', 'person_name',
            'crime_type', 'crime_type_display',
            'fraction_type', 'calculated_date', 'is_fulfilled',
            'fulfilled_date', 'description', 'notes',
            'days_until', 'alert_status'
        ]


class SentenceReductionSerializer(serializers.ModelSerializer):
    reduction_display = serializers.CharField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SentenceReduction
        fields = [
            'id', 'legal_article',
            'reduction_years', 'reduction_months', 'reduction_days',
            'reduction_display', 'applied_date',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def validate(self, data):
        # Cel puțin o valoare de reducere trebuie să fie > 0
        years = data.get('reduction_years', 0)
        months = data.get('reduction_months', 0)
        days = data.get('reduction_days', 0)
        if years == 0 and months == 0 and days == 0:
            raise serializers.ValidationError('Reducerea trebuie să aibă cel puțin o zi.')
        return data


class PreventiveArrestSerializer(serializers.ModelSerializer):
    days = serializers.IntegerField(read_only=True)
    duration_display = serializers.CharField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PreventiveArrest
        fields = [
            'id', 'start_date', 'end_date',
            'days', 'duration_display',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def validate(self, data):
        start = data.get('start_date')
        end = data.get('end_date')
        if start and end and end <= start:
            raise serializers.ValidationError(
                'Data sfârșit trebuie să fie după data început.'
            )
        return data


class ZPMSerializer(serializers.ModelSerializer):
    month_display = serializers.CharField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ZPM
        fields = [
            'id', 'month', 'year', 'days',
            'month_display',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def validate_month(self, value):
        if value < 1 or value > 12:
            raise serializers.ValidationError('Luna trebuie să fie între 1 și 12.')
        return value

    def validate_year(self, value):
        if value < 2000 or value > 2100:
            raise serializers.ValidationError('Anul trebuie să fie valid.')
        return value

    def validate_days(self, value):
        if value <= 0:
            raise serializers.ValidationError('Numărul de zile trebuie să fie mai mare decât 0.')
        if value > 31:
            raise serializers.ValidationError('Numărul de zile nu poate depăși 31.')
        return value


class SentenceListSerializer(serializers.ModelSerializer):
    fractions = FractionSerializer(many=True, read_only=True)
    reductions = SentenceReductionSerializer(many=True, read_only=True)
    preventive_arrests = PreventiveArrestSerializer(many=True, read_only=True)
    zpm_entries = ZPMSerializer(many=True, read_only=True)
    end_date = serializers.DateField(read_only=True)
    total_days = serializers.IntegerField(read_only=True)
    total_reduction_days = serializers.IntegerField(read_only=True)
    total_preventive_arrest_days = serializers.IntegerField(read_only=True)
    total_zpm_days = serializers.IntegerField(read_only=True)
    total_zpm_days_raw = serializers.FloatField(read_only=True)
    effective_years = serializers.IntegerField(read_only=True)
    effective_months = serializers.IntegerField(read_only=True)
    effective_days = serializers.IntegerField(read_only=True)
    effective_end_date = serializers.DateField(read_only=True)
    effective_duration_display = serializers.CharField(read_only=True)
    is_serious_crime = serializers.BooleanField(read_only=True)
    duration_display = serializers.CharField(read_only=True)
    crime_type_display = serializers.CharField(source='get_crime_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Sentence
        fields = [
            'id', 'person', 'crime_type', 'crime_type_display',
            'crime_description', 'sentence_years', 'sentence_months',
            'sentence_days', 'duration_display', 'start_date', 'end_date',
            'total_days', 'total_reduction_days', 'total_preventive_arrest_days',
            'total_zpm_days', 'total_zpm_days_raw',
            'effective_years', 'effective_months', 'effective_days',
            'effective_end_date', 'effective_duration_display',
            'status', 'status_display', 'is_serious_crime',
            'notes', 'fractions', 'reductions', 'preventive_arrests', 'zpm_entries',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class SentenceDetailSerializer(serializers.ModelSerializer):
    fractions = FractionSerializer(many=True, read_only=True)
    reductions = SentenceReductionSerializer(many=True, read_only=True)
    preventive_arrests = PreventiveArrestSerializer(many=True, read_only=True)
    zpm_entries = ZPMSerializer(many=True, read_only=True)
    end_date = serializers.DateField(read_only=True)
    total_days = serializers.IntegerField(read_only=True)
    total_reduction_days = serializers.IntegerField(read_only=True)
    total_preventive_arrest_days = serializers.IntegerField(read_only=True)
    total_zpm_days = serializers.IntegerField(read_only=True)
    total_zpm_days_raw = serializers.FloatField(read_only=True)
    effective_years = serializers.IntegerField(read_only=True)
    effective_months = serializers.IntegerField(read_only=True)
    effective_days = serializers.IntegerField(read_only=True)
    effective_end_date = serializers.DateField(read_only=True)
    effective_duration_display = serializers.CharField(read_only=True)
    is_serious_crime = serializers.BooleanField(read_only=True)
    duration_display = serializers.CharField(read_only=True)
    crime_type_display = serializers.CharField(source='get_crime_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    person_name = serializers.CharField(source='person.full_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Sentence
        fields = [
            'id', 'person', 'person_name', 'crime_type', 'crime_type_display',
            'crime_description', 'sentence_years', 'sentence_months',
            'sentence_days', 'duration_display', 'start_date', 'end_date',
            'total_days', 'total_reduction_days', 'total_preventive_arrest_days',
            'total_zpm_days', 'total_zpm_days_raw',
            'effective_years', 'effective_months', 'effective_days',
            'effective_end_date', 'effective_duration_display',
            'status', 'status_display', 'is_serious_crime',
            'notes', 'fractions', 'reductions', 'preventive_arrests', 'zpm_entries',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class SentenceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sentence
        fields = [
            'person', 'crime_type', 'crime_description',
            'sentence_years', 'sentence_months', 'sentence_days',
            'start_date', 'status', 'notes'
        ]

    def validate(self, attrs):
        # Ensure at least some duration is provided
        years = attrs.get('sentence_years', 0)
        months = attrs.get('sentence_months', 0)
        days = attrs.get('sentence_days', 0)

        if years == 0 and months == 0 and days == 0:
            raise serializers.ValidationError(
                {'sentence_years': 'Trebuie specificată o durată a pedepsei.'}
            )
        return attrs


class SentenceUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sentence
        fields = [
            'crime_type', 'crime_description',
            'sentence_years', 'sentence_months', 'sentence_days',
            'start_date', 'status', 'notes'
        ]

    def validate(self, attrs):
        # Ensure at least some duration is provided
        instance = self.instance
        years = attrs.get('sentence_years', instance.sentence_years)
        months = attrs.get('sentence_months', instance.sentence_months)
        days = attrs.get('sentence_days', instance.sentence_days)

        if years == 0 and months == 0 and days == 0:
            raise serializers.ValidationError(
                {'sentence_years': 'Trebuie specificată o durată a pedepsei.'}
            )
        return attrs

    def update(self, instance, validated_data):
        # Check if duration changed
        duration_changed = (
            validated_data.get('sentence_years', instance.sentence_years) != instance.sentence_years or
            validated_data.get('sentence_months', instance.sentence_months) != instance.sentence_months or
            validated_data.get('sentence_days', instance.sentence_days) != instance.sentence_days or
            validated_data.get('start_date', instance.start_date) != instance.start_date
        )

        instance = super().update(instance, validated_data)

        # Regenerate fractions if duration changed
        if duration_changed:
            instance.generate_fractions()

        return instance
