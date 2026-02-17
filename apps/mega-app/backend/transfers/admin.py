from django.contrib import admin
from .models import Transfer, TransferEntry


class TransferEntryInline(admin.TabularInline):
    model = TransferEntry
    extra = 0
    fields = ['penitentiary', 'veniti', 'veniti_reintorsi', 'veniti_noi',
              'plecati', 'plecati_izolator', 'notes']


@admin.register(Transfer)
class TransferAdmin(admin.ModelAdmin):
    list_display = ['transfer_date', 'year', 'month', 'description', 'created_by', 'created_at']
    list_filter = ['year', 'month']
    search_fields = ['description']
    readonly_fields = ['year', 'month', 'created_by', 'created_at', 'updated_at']
    ordering = ['-transfer_date']
    inlines = [TransferEntryInline]

    fieldsets = (
        ('Transfer', {
            'fields': ('transfer_date', 'year', 'month', 'description')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
