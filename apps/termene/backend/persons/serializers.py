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
    class Meta:
        model = ConvictedPerson
        fields = [
            'first_name', 'last_name', 'cnp',
            'date_of_birth', 'admission_date', 'notes'
        ]

    def validate_cnp(self, value):
        if not value.isdigit() or len(value) != 13:
            raise serializers.ValidationError('CNP-ul trebuie să conțină exact 13 cifre.')
        return value


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
