import uuid
import re
from django.db import models
from django.conf import settings
from django.core.validators import RegexValidator


cnp_validator = RegexValidator(
    regex=r'^\d{13}$',
    message='CNP-ul trebuie să conțină exact 13 cifre.'
)


class ConvictedPerson(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(
        max_length=100,
        verbose_name='Prenume'
    )
    last_name = models.CharField(
        max_length=100,
        verbose_name='Nume'
    )
    cnp = models.CharField(
        max_length=13,
        unique=True,
        validators=[cnp_validator],
        verbose_name='CNP'
    )
    date_of_birth = models.DateField(
        verbose_name='Data nașterii'
    )
    admission_date = models.DateField(
        verbose_name='Data internării'
    )
    notes = models.TextField(
        blank=True,
        verbose_name='Note'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_persons',
        verbose_name='Creat de'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Creat la')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Actualizat la')

    class Meta:
        verbose_name = 'Persoană condamnată'
        verbose_name_plural = 'Persoane condamnate'
        ordering = ['last_name', 'first_name']
        indexes = [
            models.Index(fields=['cnp']),
            models.Index(fields=['last_name', 'first_name']),
            models.Index(fields=['admission_date']),
        ]

    def __str__(self):
        return f"{self.last_name} {self.first_name} ({self.cnp})"

    @property
    def full_name(self):
        return f"{self.last_name} {self.first_name}"

    @property
    def active_sentences_count(self):
        return self.sentences.filter(status='active').count()

    @property
    def nearest_fraction(self):
        """Returns the nearest unfulfilled fraction date."""
        from sentences.models import Fraction
        from django.utils import timezone
        today = timezone.now().date()

        fraction = Fraction.objects.filter(
            sentence__person=self,
            sentence__status='active',
            is_fulfilled=False,
            calculated_date__gte=today
        ).order_by('calculated_date').first()

        return fraction
