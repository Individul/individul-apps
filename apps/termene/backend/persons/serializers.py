from rest_framework import serializers
from .models import ConvictedPerson
from sentences.serializers import SentenceListSerializer


class ConvictedPersonListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    active_sentences_count = serializers.IntegerField(read_only=True)
    nearest_fraction_date = serializers.SerializerMethodField()
    nearest_fraction_type = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ConvictedPerson
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'cnp',
            'date_of_birth', 'admission_date', 'active_sentences_count',
            'nearest_fraction_date', 'nearest_fraction_type',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]

    def get_nearest_fraction_date(self, obj):
        fraction = obj.nearest_fraction
        return fraction.calculated_date if fraction else None

    def get_nearest_fraction_type(self, obj):
        fraction = obj.nearest_fraction
        return fraction.fraction_type if fraction else None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class ConvictedPersonDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    active_sentences_count = serializers.IntegerField(read_only=True)
    sentences = SentenceListSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ConvictedPerson
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'cnp',
            'date_of_birth', 'admission_date', 'notes',
            'active_sentences_count', 'sentences',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class ConvictedPersonCreateSerializer(serializers.ModelSerializer):
    # Sentence fields for creating person with sentence
    start_date = serializers.DateField(write_only=True)
    sentence_years = serializers.IntegerField(write_only=True, min_value=0)
    sentence_months = serializers.IntegerField(write_only=True, min_value=0, max_value=11)
    sentence_days = serializers.IntegerField(write_only=True, min_value=0, max_value=30)

    class Meta:
        model = ConvictedPerson
        fields = [
            'id', 'first_name', 'last_name',
            'start_date', 'sentence_years', 'sentence_months', 'sentence_days'
        ]
        read_only_fields = ['id']

    def validate(self, data):
        # Ensure at least some sentence duration
        years = data.get('sentence_years', 0)
        months = data.get('sentence_months', 0)
        days = data.get('sentence_days', 0)
        if years == 0 and months == 0 and days == 0:
            raise serializers.ValidationError({'sentence_years': 'Pedeapsa trebuie să aibă cel puțin o zi.'})
        return data

    def create(self, validated_data):
        from sentences.models import Sentence

        # Extract sentence data
        start_date = validated_data.pop('start_date')
        sentence_years = validated_data.pop('sentence_years')
        sentence_months = validated_data.pop('sentence_months')
        sentence_days = validated_data.pop('sentence_days')

        # Create person
        person = ConvictedPerson.objects.create(**validated_data)

        # Create sentence
        Sentence.objects.create(
            person=person,
            crime_type='altul',
            start_date=start_date,
            sentence_years=sentence_years,
            sentence_months=sentence_months,
            sentence_days=sentence_days,
            status='active',
            created_by=validated_data.get('created_by')
        )

        return person


class ConvictedPersonUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConvictedPerson
        fields = [
            'first_name', 'last_name', 'cnp',
            'date_of_birth', 'admission_date', 'notes'
        ]

    def validate_cnp(self, value):
        if not value.isdigit() or len(value) != 13:
            raise serializers.ValidationError('CNP-ul trebuie să conțină exact 13 cifre.')
        # Check uniqueness excluding current instance
        instance = self.instance
        if ConvictedPerson.objects.filter(cnp=value).exclude(pk=instance.pk).exists():
            raise serializers.ValidationError('O persoană cu acest CNP există deja.')
        return value
