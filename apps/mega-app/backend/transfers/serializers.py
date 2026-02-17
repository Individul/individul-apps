from rest_framework import serializers
from django.db.models import Sum
from .models import Transfer, TransferEntry, Penitentiary, ISOLATOR_VALUES


class TransferEntrySerializer(serializers.ModelSerializer):
    """Serializare randuri transfer pentru citire (nested in detail)."""
    penitentiary_display = serializers.CharField(
        source='get_penitentiary_display', read_only=True
    )
    is_isolator = serializers.BooleanField(read_only=True)

    class Meta:
        model = TransferEntry
        fields = [
            'id', 'penitentiary', 'penitentiary_display', 'is_isolator',
            'veniti', 'veniti_reintorsi', 'veniti_noi',
            'plecati', 'plecati_izolator',
            'notes',
        ]
        read_only_fields = ['id']


class TransferListSerializer(serializers.ModelSerializer):
    """Serializare transfer pentru lista (header + totaluri calculate)."""
    created_by_name = serializers.SerializerMethodField()
    total_veniti = serializers.SerializerMethodField()
    total_plecati = serializers.SerializerMethodField()
    entries_count = serializers.SerializerMethodField()
    quarter = serializers.IntegerField(read_only=True)

    class Meta:
        model = Transfer
        fields = [
            'id', 'transfer_date', 'year', 'month', 'quarter',
            'description',
            'total_veniti', 'total_plecati', 'entries_count',
            'created_by', 'created_by_name', 'created_at',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_total_veniti(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'entries' in obj._prefetched_objects_cache:
            return sum(e.veniti for e in obj.entries.all())
        return obj.entries.aggregate(total=Sum('veniti'))['total'] or 0

    def get_total_plecati(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'entries' in obj._prefetched_objects_cache:
            return sum(e.plecati for e in obj.entries.all())
        return obj.entries.aggregate(total=Sum('plecati'))['total'] or 0

    def get_entries_count(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'entries' in obj._prefetched_objects_cache:
            return len(obj.entries.all())
        return obj.entries.count()


class TransferDetailSerializer(serializers.ModelSerializer):
    """Serializare transfer complet cu entries nested."""
    entries = TransferEntrySerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    quarter = serializers.IntegerField(read_only=True)

    class Meta:
        model = Transfer
        fields = [
            'id', 'transfer_date', 'year', 'month', 'quarter',
            'description', 'entries',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'year', 'month', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class TransferEntryInputSerializer(serializers.Serializer):
    """Validare input pentru un rand de transfer."""
    penitentiary = serializers.IntegerField()
    veniti = serializers.IntegerField(default=0, min_value=0)
    veniti_reintorsi = serializers.IntegerField(default=0, min_value=0)
    veniti_noi = serializers.IntegerField(default=0, min_value=0)
    plecati = serializers.IntegerField(default=0, min_value=0)
    plecati_izolator = serializers.IntegerField(default=0, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_penitentiary(self, value):
        if value == Penitentiary.P_6:
            raise serializers.ValidationError(
                'Nu se pot inregistra transferuri catre propriul penitenciar (P-6).'
            )
        valid_values = [p.value for p in Penitentiary]
        if value not in valid_values:
            raise serializers.ValidationError('Penitenciar invalid.')
        return value

    def validate(self, data):
        veniti = data.get('veniti', 0)
        veniti_r = data.get('veniti_reintorsi', 0)
        veniti_n = data.get('veniti_noi', 0)
        if veniti != veniti_r + veniti_n:
            raise serializers.ValidationError({
                'veniti': 'Total veniti trebuie sa fie egal cu reintorsi + noi.'
            })

        plecati_izolator = data.get('plecati_izolator', 0)
        pen = data.get('penitentiary')
        if plecati_izolator > 0 and pen not in ISOLATOR_VALUES:
            raise serializers.ValidationError({
                'plecati_izolator': 'Plecati la izolator se completeaza doar pentru P-11 si P-13.'
            })

        return data


class TransferCreateSerializer(serializers.Serializer):
    """Creare transfer cu entries."""
    transfer_date = serializers.DateField()
    description = serializers.CharField(required=False, allow_blank=True, default='')
    entries = TransferEntryInputSerializer(many=True)

    def validate_entries(self, value):
        if not value:
            raise serializers.ValidationError('Cel putin un rand este necesar.')
        # Verificare penitenciare duplicate
        pens = [e['penitentiary'] for e in value]
        if len(pens) != len(set(pens)):
            raise serializers.ValidationError('Penitenciar duplicat in lista.')
        return value

    def create(self, validated_data):
        entries_data = validated_data.pop('entries')
        request = self.context['request']

        transfer = Transfer.objects.create(
            transfer_date=validated_data['transfer_date'],
            description=validated_data.get('description', ''),
            created_by=request.user,
        )

        for entry_data in entries_data:
            TransferEntry.objects.create(transfer=transfer, **entry_data)

        return transfer


class TransferUpdateSerializer(serializers.Serializer):
    """Actualizare transfer (header + inlocuire entries)."""
    transfer_date = serializers.DateField(required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    entries = TransferEntryInputSerializer(many=True, required=False)

    def validate_entries(self, value):
        if value is not None:
            pens = [e['penitentiary'] for e in value]
            if len(pens) != len(set(pens)):
                raise serializers.ValidationError('Penitenciar duplicat in lista.')
        return value

    def update(self, instance, validated_data):
        entries_data = validated_data.pop('entries', None)

        if 'transfer_date' in validated_data:
            instance.transfer_date = validated_data['transfer_date']
        if 'description' in validated_data:
            instance.description = validated_data['description']
        instance.save()

        if entries_data is not None:
            # Inlocuim toate entries (delete + create)
            instance.entries.all().delete()
            for entry_data in entries_data:
                TransferEntry.objects.create(transfer=instance, **entry_data)

        return instance
