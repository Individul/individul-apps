from rest_framework import serializers
from django.conf import settings
from .models import Petition, PetitionAttachment


class PetitionAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = PetitionAttachment
        fields = [
            'id', 'file', 'file_url', 'original_filename', 'size_bytes',
            'content_type', 'uploaded_by', 'uploaded_by_name', 'uploaded_at'
        ]
        read_only_fields = ['id', 'uploaded_by', 'uploaded_at', 'size_bytes']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.id and request:
            # Use the download endpoint instead of direct media URL
            # This works in both development and production
            from django.urls import reverse
            download_url = reverse('attachment-download', kwargs={'pk': obj.id})
            return request.build_absolute_uri(download_url)
        return None

    def validate_file(self, value):
        max_size = getattr(settings, 'MAX_UPLOAD_SIZE', 20 * 1024 * 1024)
        if value.size > max_size:
            raise serializers.ValidationError(
                f'Fișierul este prea mare. Dimensiunea maximă permisă este {max_size // (1024*1024)} MB.'
            )
        return value


class PetitionListSerializer(serializers.ModelSerializer):
    registration_number = serializers.ReadOnlyField()
    response_due_date = serializers.DateField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    is_due_soon = serializers.BooleanField(read_only=True)
    days_until_due = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    petitioner_type_display = serializers.CharField(source='get_petitioner_type_display', read_only=True)
    detention_sector_display = serializers.CharField(source='get_detention_sector_display', read_only=True)
    object_type_display = serializers.CharField(source='get_object_type_display', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    attachments_count = serializers.SerializerMethodField()

    class Meta:
        model = Petition
        fields = [
            'id', 'registration_number', 'registration_prefix', 'registration_seq',
            'registration_year', 'registration_date', 'petitioner_type',
            'petitioner_type_display', 'petitioner_name', 'detainee_fullname',
            'detention_sector', 'detention_sector_display',
            'object_type', 'object_type_display', 'status', 'status_display',
            'assigned_to', 'assigned_to_name', 'response_due_date',
            'is_overdue', 'is_due_soon', 'days_until_due', 'resolution_date',
            'created_by', 'created_by_name', 'created_at', 'attachments_count'
        ]

    def get_attachments_count(self, obj):
        return obj.attachments.count()


class PetitionDetailSerializer(serializers.ModelSerializer):
    registration_number = serializers.ReadOnlyField()
    response_due_date = serializers.DateField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    is_due_soon = serializers.BooleanField(read_only=True)
    days_until_due = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    petitioner_type_display = serializers.CharField(source='get_petitioner_type_display', read_only=True)
    detention_sector_display = serializers.CharField(source='get_detention_sector_display', read_only=True)
    object_type_display = serializers.CharField(source='get_object_type_display', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    attachments = PetitionAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Petition
        fields = [
            'id', 'registration_number', 'registration_prefix', 'registration_seq',
            'registration_year', 'registration_date', 'petitioner_type',
            'petitioner_type_display', 'petitioner_name', 'detainee_fullname',
            'detention_sector', 'detention_sector_display',
            'object_type', 'object_type_display', 'object_description',
            'status', 'status_display', 'assigned_to', 'assigned_to_name',
            'response_due_date', 'is_overdue', 'is_due_soon', 'days_until_due',
            'resolution_date', 'resolution_text', 'created_by', 'created_by_name',
            'created_at', 'updated_at', 'attachments'
        ]
        read_only_fields = [
            'id', 'registration_number', 'registration_seq', 'registration_year',
            'created_by', 'created_at', 'updated_at'
        ]


class PetitionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Petition
        fields = [
            'id', 'registration_prefix', 'registration_date', 'petitioner_type',
            'petitioner_name', 'detainee_fullname', 'detention_sector', 'object_type',
            'object_description', 'assigned_to'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'detention_sector': {'required': True},
        }

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class PetitionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Petition
        fields = [
            'petitioner_type', 'petitioner_name', 'detainee_fullname',
            'detention_sector', 'object_type', 'object_description', 'status', 'assigned_to',
            'resolution_date', 'resolution_text'
        ]


class PetitionStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    by_status = serializers.DictField()
    due_soon = serializers.IntegerField()
    overdue = serializers.IntegerField()
    by_object_type = serializers.DictField()
    by_petitioner_type = serializers.DictField()
    by_detention_sector = serializers.DictField()


class AttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    petition_id = serializers.UUIDField()

    def validate_file(self, value):
        max_size = getattr(settings, 'MAX_UPLOAD_SIZE', 20 * 1024 * 1024)
        if value.size > max_size:
            raise serializers.ValidationError(
                f'Fișierul este prea mare. Dimensiunea maximă permisă este {max_size // (1024*1024)} MB.'
            )

        allowed_extensions = getattr(settings, 'ALLOWED_UPLOAD_EXTENSIONS', ['.pdf', '.jpg', '.jpeg', '.png'])
        ext = '.' + value.name.split('.')[-1].lower()
        if ext not in allowed_extensions:
            raise serializers.ValidationError(
                f'Tip de fișier nepermis. Extensii acceptate: {", ".join(allowed_extensions)}'
            )

        return value
