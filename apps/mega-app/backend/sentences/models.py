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

    @property
    def total_reduction_days(self):
        """Total zile reduse din toate reducerile."""
        total = 0
        for r in self.reductions.all():
            total += (r.reduction_years * 365) + (r.reduction_months * 30) + r.reduction_days
        return total

    @property
    def effective_total_days(self):
        """Total zile efective după reduceri."""
        return max(0, self.total_days - self.total_reduction_days)

    @property
    def effective_years(self):
        """Ani efectivi după reduceri."""
        return self.effective_total_days // 365

    @property
    def effective_months(self):
        """Luni efective după reduceri."""
        remaining = self.effective_total_days % 365
        return remaining // 30

    @property
    def effective_days(self):
        """Zile efective după reduceri."""
        remaining = self.effective_total_days % 365
        return remaining % 30

    @property
    def effective_end_date(self):
        """Data efectivă de eliberare după reduceri."""
        return calculate_end_date(
            self.start_date,
            self.effective_years,
            self.effective_months,
            self.effective_days
        )

    @property
    def effective_duration_display(self):
        """Durată efectivă formatată."""
        parts = []
        if self.effective_years:
            parts.append(f"{self.effective_years} {'an' if self.effective_years == 1 else 'ani'}")
        if self.effective_months:
            parts.append(f"{self.effective_months} {'lună' if self.effective_months == 1 else 'luni'}")
        if self.effective_days:
            parts.append(f"{self.effective_days} {'zi' if self.effective_days == 1 else 'zile'}")
        return ', '.join(parts) if parts else '0 zile'

    def generate_fractions(self):
        """Generate or regenerate fractions for this sentence using effective duration."""
        # Delete existing fractions
        self.fractions.all().delete()

        # Use effective duration (after reductions)
        effective_years = self.effective_years
        effective_months = self.effective_months
        effective_days = self.effective_days

        # Generate new fractions based on effective duration
        for frac_info in FRACTION_TYPES:
            calculated_date = calculate_fraction_date(
                self.start_date,
                effective_years,
                effective_months,
                effective_days,
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


class SentenceReduction(models.Model):
    """Reducere de pedeapsă conform articolelor legale."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sentence = models.ForeignKey(
        'Sentence',
        on_delete=models.CASCADE,
        related_name='reductions',
        verbose_name='Sentință'
    )

    # Articolul legal
    legal_article = models.CharField(max_length=50, verbose_name='Articol legal')

    # Durata redusă
    reduction_years = models.PositiveSmallIntegerField(default=0, verbose_name='Ani reduși')
    reduction_months = models.PositiveSmallIntegerField(default=0, verbose_name='Luni reduse')
    reduction_days = models.PositiveSmallIntegerField(default=0, verbose_name='Zile reduse')

    # Data aplicării
    applied_date = models.DateField(verbose_name='Data aplicării')

    # Audit
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_reductions',
        verbose_name='Creat de'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Creat la')

    class Meta:
        ordering = ['-applied_date', '-created_at']
        verbose_name = 'Reducere pedeapsă'
        verbose_name_plural = 'Reduceri pedeapsă'

    def __str__(self):
        return f"{self.sentence.person.full_name} - {self.legal_article} ({self.reduction_display})"

    @property
    def reduction_display(self):
        """Format: '1 an, 2 luni, 5 zile'"""
        parts = []
        if self.reduction_years:
            parts.append(f"{self.reduction_years} {'an' if self.reduction_years == 1 else 'ani'}")
        if self.reduction_months:
            parts.append(f"{self.reduction_months} {'lună' if self.reduction_months == 1 else 'luni'}")
        if self.reduction_days:
            parts.append(f"{self.reduction_days} {'zi' if self.reduction_days == 1 else 'zile'}")
        return ', '.join(parts) if parts else '0 zile'

    @property
    def total_reduction_days(self):
        """Total zile reduse din această reducere."""
        return (self.reduction_years * 365) + (self.reduction_months * 30) + self.reduction_days


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
