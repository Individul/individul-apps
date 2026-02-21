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
        blank=True,
        null=True,
        validators=[cnp_validator],
        verbose_name='CNP'
    )
    date_of_birth = models.DateField(
        blank=True,
        null=True,
        verbose_name='Data nașterii'
    )
    admission_date = models.DateField(
        blank=True,
        null=True,
        verbose_name='Data internării'
    )
    class ReleaseType(models.TextChoices):
        FULL_TERM = 'full_term', 'Executarea integrală'
        ART_91 = 'art_91', 'Art. 91'
        ART_92 = 'art_92', 'Art. 92'
        CONDITIONS = 'conditions', 'Condiții'

    release_date = models.DateField(
        blank=True,
        null=True,
        verbose_name='Data eliberarii'
    )
    release_type = models.CharField(
        max_length=20,
        choices=ReleaseType.choices,
        blank=True,
        default='',
        verbose_name='Modalitatea eliberării'
    )
    notes = models.TextField(
        blank=True,
        verbose_name='Note'
    )
    mai_notification = models.BooleanField(
        default=False,
        verbose_name='Înștiințare MAI'
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
            models.Index(fields=['release_date']),
        ]

    def __str__(self):
        if self.cnp:
            return f"{self.last_name} {self.first_name} ({self.cnp})"
        return f"{self.last_name} {self.first_name}"

    @property
    def full_name(self):
        return f"{self.last_name} {self.first_name}"

    @property
    def active_sentences_count(self):
        return self.sentences.exclude(status='finished').count()

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

    @property
    def active_sentence_end_date(self):
        """Returns the effective end date of the active sentence."""
        active = self.sentences.filter(status='active').first()
        if active:
            return active.effective_end_date
        return None

    @property
    def has_fulfilled_fractions(self):
        """Returns True if person has sentences but all fractions are fulfilled."""
        from sentences.models import Fraction
        total_fractions = Fraction.objects.filter(
            sentence__person=self,
            sentence__status='active',
        ).count()
        if total_fractions == 0:
            return False
        unfulfilled = Fraction.objects.filter(
            sentence__person=self,
            sentence__status='active',
            is_fulfilled=False,
        ).count()
        return unfulfilled == 0
