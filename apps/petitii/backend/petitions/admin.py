from django.contrib import admin
from .models import Petition, PetitionAttachment


class PetitionAttachmentInline(admin.TabularInline):
    model = PetitionAttachment
    extra = 0
    readonly_fields = ['uploaded_at', 'uploaded_by', 'size_bytes']


@admin.register(Petition)
class PetitionAdmin(admin.ModelAdmin):
    list_display = [
        'registration_number', 'registration_date', 'petitioner_type',
        'petitioner_name', 'detention_sector', 'object_type', 'status', 'assigned_to',
        'response_due_date', 'is_overdue'
    ]
    list_filter = ['status', 'petitioner_type', 'detention_sector', 'object_type', 'registration_year']
    search_fields = ['petitioner_name', 'detainee_fullname', 'registration_seq']
    date_hierarchy = 'registration_date'
    readonly_fields = ['registration_seq', 'registration_year', 'created_by', 'created_at', 'updated_at']
    inlines = [PetitionAttachmentInline]

    fieldsets = (
        ('Înregistrare', {
            'fields': ('registration_prefix', 'registration_seq', 'registration_year', 'registration_date')
        }),
        ('Petiționar', {
            'fields': ('petitioner_type', 'petitioner_name', 'detainee_fullname', 'detention_sector')
        }),
        ('Obiect', {
            'fields': ('object_type', 'object_description')
        }),
        ('Status și Atribuire', {
            'fields': ('status', 'assigned_to')
        }),
        ('Rezoluție', {
            'fields': ('resolution_date', 'resolution_text')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(PetitionAttachment)
class PetitionAttachmentAdmin(admin.ModelAdmin):
    list_display = ['original_filename', 'petition', 'content_type', 'size_bytes', 'uploaded_by', 'uploaded_at']
    list_filter = ['content_type', 'uploaded_at']
    search_fields = ['original_filename', 'petition__petitioner_name']
    readonly_fields = ['uploaded_at']
