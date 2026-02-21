from django.contrib import admin
from .models import Sentence, Fraction, SentenceReduction, PreventiveArrest


class FractionInline(admin.TabularInline):
    model = Fraction
    extra = 0
    readonly_fields = ['id', 'fraction_type', 'calculated_date', 'days_until', 'alert_status']
    fields = ['fraction_type', 'calculated_date', 'is_fulfilled', 'fulfilled_date', 'notes']


class PreventiveArrestInline(admin.TabularInline):
    model = PreventiveArrest
    extra = 0
    readonly_fields = ['id', 'created_by', 'created_at']
    fields = ['start_date', 'end_date', 'created_by', 'created_at']


@admin.register(Sentence)
class SentenceAdmin(admin.ModelAdmin):
    list_display = ['person', 'crime_type', 'duration_display', 'start_date', 'end_date', 'status']
    list_filter = ['status', 'crime_type', 'start_date']
    search_fields = ['person__first_name', 'person__last_name', 'crime_description']
    readonly_fields = ['id', 'end_date', 'total_days', 'is_serious_crime', 'created_by', 'created_at', 'updated_at']
    inlines = [FractionInline, PreventiveArrestInline]
    ordering = ['-start_date']


@admin.register(Fraction)
class FractionAdmin(admin.ModelAdmin):
    list_display = ['sentence', 'fraction_type', 'calculated_date', 'is_fulfilled', 'alert_status']
    list_filter = ['fraction_type', 'is_fulfilled', 'calculated_date']
    search_fields = ['sentence__person__first_name', 'sentence__person__last_name']
    readonly_fields = ['id', 'days_until', 'alert_status', 'created_at', 'updated_at']
    ordering = ['calculated_date']


@admin.register(PreventiveArrest)
class PreventiveArrestAdmin(admin.ModelAdmin):
    list_display = ['sentence', 'start_date', 'end_date', 'days']
    list_filter = ['start_date']
    search_fields = ['sentence__person__first_name', 'sentence__person__last_name']
    readonly_fields = ['id', 'created_by', 'created_at']
    ordering = ['start_date']
