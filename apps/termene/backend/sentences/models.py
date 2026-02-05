import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from dateutil.relativedelta import relativedelta

from .calculations import (
    calculate_fraction_date,
    calculate_end_date,
    calculate_total_days,
    FRACTION_TYPES,
    SERIOUS_CRIMES,
)


class Sentence(models.Model):
    class CrimeType(models.TextChoices):
        FURT = 'furt', 'Furt'
        FURT_CALIFICAT = 'furt_calificat', 'Furt calificat'
        TALHARIE = 'talharie', 'Tâlhărie'
        OMOR = 'omor', 'Omor'
        OMOR_CALIFICAT = 'omor_calificat', 'Omor calificat'
        VIOL = 'viol', 'Viol'
        TRAFIC_PERSOANE = 'trafic_persoane', 'Trafic de persoane'
        TRAFIC_DROGURI = 'trafic_droguri', 'Trafic de droguri'
        TERORISM = 'terorism', 'Terorism'
        CORUPTIE = 'coruptie', 'Corupție'
        EVAZIUNE = 'evaziune', 'Evaziune fiscală'
        INSELACIUNE = 'inselaciune', 'Înșelăciune'
        DISTRUGERE = 'distrugere', 'Distrugere'
        ULTRAJ = 'ultraj', 'Ultraj'
        LOVIRE = 'lovire', 'Lovire sau alte violențe'
        VATAMARE = 'vatamare', 'Vătămare corporală'
        ALTUL = 'altul', 'Altul'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Activă'
        SUSPENDED = 'suspended', 'Suspendată'
        COMPLETED = 'completed', 'Finalizată'
        CONDITIONALLY_RELEASED = 'conditionally_released', 'Liberare condiționată'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    person = models.ForeignKey(
        'persons.ConvictedPerson',
        on_delete=models.CASCADE,
        related_name='sentences',
        verbose_name='Persoană condamnată'
    )
    crime_type = models.CharField(
        max_length=30,
        choices=CrimeType.choices,
        verbose_name='Tip infracțiune'
    )
    crime_description = models.TextField(
        blank=True,
        verbose_name='Descriere infracțiune'
    )
    sentence_years = models.PositiveSmallIntegerField(
        default=0,
        verbose_name='Ani'
    )
    sentence_months = models.PositiveSmallIntegerField(
        default=0,
        verbose_name='Luni'
    )
    sentence_days = models.PositiveSmallIntegerField(
        default=0,
        verbose_name='Zile'
    )
    start_date = models.DateField(
        verbose_name='Data începerii executării'
    )
    status = models.CharField(
        max_length=25,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name='Status'
    )
    notes = models.TextField(
        blank=True,
        verbose_name='Note'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_sentences',
        verbose_name='Creat de'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Creat la')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Actualizat la')

    class Meta:
        verbose_name = 'Sentință'
        verbose_name_plural = 'Sentințe'
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['start_date']),
            models.Index(fields=['crime_type']),
        ]

    def __str__(self):
        duration = f"{self.sentence_years}a {self.sentence_months}l {self.sentence_days}z"
        return f"{self.person.full_name} - {self.get_crime_type_display()} ({duration})"

    @property
    def end_date(self):
        """Calculate the end date of the sentence."""
        return calculate_end_date(
            self.start_date,
            self.sentence_years,
            self.sentence_months,
            self.sentence_days
        )

    @property
    def total_days(self):
        """Calculate total days of the sentence."""
        return calculate_total_days(
            self.sentence_years,
            self.sentence_months,
            self.sentence_days
        )

    @property
    def is_serious_crime(self):
        """Check if this is a serious crime requiring 2/3 fraction."""
        return self.crime_type in SERIOUS_CRIMES

    @property
    def duration_display(self):
        """Human-readable duration."""
        parts = []
        if self.sentence_years:
            parts.append(f"{self.sentence_years} {'an' if self.sentence_years == 1 else 'ani'}")
        if self.sentence_months:
            parts.append(f"{self.sentence_months} {'lună' if self.sentence_months == 1 else 'luni'}")
        if self.sentence_days:
            parts.append(f"{self.sentence_days} {'zi' if self.sentence_days == 1 else 'zile'}")
        return ', '.join(parts) if parts else '0 zile'

    def generate_fractions(self):
        """Generate or regenerate fractions for this sentence."""
        # Delete existing fractions
        self.fractions.all().delete()

        # Generate new fractions
        for frac_info in FRACTION_TYPES:
            calculated_date = calculate_fraction_date(
                self.start_date,
                self.sentence_years,
                self.sentence_months,
                self.sentence_days,
                frac_info['numerator'],
                frac_info['denominator']
            )

            Fraction.objects.create(
                sentence=self,
                fraction_type=frac_info['type'],
                calculated_date=calculated_date,
                description=frac_info['description'],
            )

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        # Auto-generate fractions on creation or when sentence duration changes
        if is_new:
            self.generate_fractions()


class Fraction(models.Model):
    class FractionType(models.TextChoices):
        ONE_THIRD = '1/3', '1/3'
        ONE_HALF = '1/2', '1/2'
        TWO_THIRDS = '2/3', '2/3'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sentence = models.ForeignKey(
        Sentence,
        on_delete=models.CASCADE,
        related_name='fractions',
        verbose_name='Sentință'
    )
    fraction_type = models.CharField(
        max_length=10,
        choices=FractionType.choices,
        verbose_name='Tip fracție'
    )
    calculated_date = models.DateField(
        verbose_name='Data calculată'
    )
    is_fulfilled = models.BooleanField(
        default=False,
        verbose_name='Îndeplinit'
    )
    fulfilled_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Data îndeplinirii'
    )
    description = models.TextField(
        blank=True,
        verbose_name='Descriere'
    )
    notes = models.TextField(
        blank=True,
        verbose_name='Note'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Creat la')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Actualizat la')

    class Meta:
        verbose_name = 'Fracție'
        verbose_name_plural = 'Fracții'
        ordering = ['calculated_date']
        indexes = [
            models.Index(fields=['calculated_date']),
            models.Index(fields=['is_fulfilled']),
            models.Index(fields=['fraction_type']),
        ]

    def __str__(self):
        return f"{self.sentence.person.full_name} - {self.fraction_type} ({self.calculated_date})"

    @property
    def days_until(self):
        """Days until this fraction date."""
        today = timezone.now().date()
        return (self.calculated_date - today).days

    @property
    def alert_status(self):
        """
        Determine the alert status based on days until calculated date.
        Returns: 'fulfilled', 'overdue', 'imminent', 'upcoming', or 'distant'
        """
        if self.is_fulfilled:
            return 'fulfilled'

        days = self.days_until
        imminent_days = getattr(settings, 'FRACTION_IMMINENT_DAYS', 30)
        upcoming_days = getattr(settings, 'FRACTION_UPCOMING_DAYS', 90)

        if days < 0:
            return 'overdue'
        elif days <= imminent_days:
            return 'imminent'
        elif days <= upcoming_days:
            return 'upcoming'
        else:
            return 'distant'
