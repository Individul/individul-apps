from django.contrib import admin
from .models import ConvictedPerson


@admin.register(ConvictedPerson)
class ConvictedPersonAdmin(admin.ModelAdmin):
    list_display = ['last_name', 'first_name', 'cnp', 'admission_date', 'created_at']
    list_filter = ['admission_date', 'created_at']
    search_fields = ['first_name', 'last_name', 'cnp']
    readonly_fields = ['id', 'created_by', 'created_at', 'updated_at']
    ordering = ['last_name', 'first_name']
