from django.contrib import admin
from .models import Indicatie, IndicatieDestinatari, IndicatieComentariu, IndicatieFisier


class DestinatariInline(admin.TabularInline):
    model = IndicatieDestinatari
    extra = 1


@admin.register(Indicatie)
class IndicatieAdmin(admin.ModelAdmin):
    list_display = ['titlu', 'prioritate', 'created_by', 'termen_limita', 'created_at']
    list_filter = ['prioritate', 'termen_limita']
    search_fields = ['titlu', 'descriere']
    inlines = [DestinatariInline]


@admin.register(IndicatieComentariu)
class ComentariuAdmin(admin.ModelAdmin):
    list_display = ['indicatie', 'autor', 'created_at']


@admin.register(IndicatieFisier)
class FisierAdmin(admin.ModelAdmin):
    list_display = ['indicatie', 'uploaded_by', 'nume_fisier', 'created_at']
