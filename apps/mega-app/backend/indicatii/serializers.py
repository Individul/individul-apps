from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Indicatie, IndicatieDestinatari, IndicatieComentariu, IndicatieFisier

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


class DestinatarSerializer(serializers.ModelSerializer):
    destinatar_details = UserSerializer(source='destinatar', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = IndicatieDestinatari
        fields = ['id', 'destinatar', 'destinatar_details', 'status', 'status_display', 'data_indeplinire']
        read_only_fields = ['id', 'data_indeplinire']


class ComentariuSerializer(serializers.ModelSerializer):
    autor_details = UserSerializer(source='autor', read_only=True)

    class Meta:
        model = IndicatieComentariu
        fields = ['id', 'autor', 'autor_details', 'text', 'created_at']
        read_only_fields = ['id', 'autor', 'created_at']


class FisierSerializer(serializers.ModelSerializer):
    uploaded_by_details = UserSerializer(source='uploaded_by', read_only=True)

    class Meta:
        model = IndicatieFisier
        fields = ['id', 'uploaded_by', 'uploaded_by_details', 'fisier', 'nume_fisier', 'created_at']
        read_only_fields = ['id', 'uploaded_by', 'created_at']


class IndicatieListSerializer(serializers.ModelSerializer):
    created_by_details = UserSerializer(source='created_by', read_only=True)
    destinatari = DestinatarSerializer(many=True, read_only=True)
    destinatari_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    persoana_legata_name = serializers.SerializerMethodField()

    class Meta:
        model = Indicatie
        fields = [
            'id', 'titlu', 'descriere', 'prioritate', 'termen_limita',
            'created_by', 'created_by_details', 'destinatari', 'destinatari_ids',
            'persoana_legata', 'persoana_legata_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_persoana_legata_name(self, obj):
        if obj.persoana_legata:
            return f"{obj.persoana_legata.last_name} {obj.persoana_legata.first_name}"
        return None

    def validate_titlu(self, value):
        if not value.strip():
            raise serializers.ValidationError("Titlul nu poate fi gol.")
        return value.strip()


class IndicatieDetailSerializer(IndicatieListSerializer):
    comentarii = ComentariuSerializer(many=True, read_only=True)
    fisiere = FisierSerializer(many=True, read_only=True)

    class Meta(IndicatieListSerializer.Meta):
        fields = IndicatieListSerializer.Meta.fields + ['comentarii', 'fisiere']
