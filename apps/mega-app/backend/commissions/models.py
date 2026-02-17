import uuid
from django.db import models
from django.conf import settings


class Article(models.TextChoices):
    ART_91 = 'art_91', 'Art. 91'
    ART_92 = 'art_92', 'Art. 92'
    ART_107 = 'art_107', 'Art. 107'
    GRATIERE = 'gratiere', 'Grațiere'


class ProgramResult(models.TextChoices):
    REALIZAT = 'realizat', 'Realizat'
    NEREALIZAT = 'nerealizat', 'Nerealizat'
    NEREALIZAT_INDEPENDENT = 'nerealizat_independent', 'Nerealizat din motive independente'


class BehaviorResult(models.TextChoices):
    POZITIV = 'pozitiv', 'Pozitiv'
    NEGATIV = 'negativ', 'Negativ'


class Decision(models.TextChoices):
    ADMIS = 'admis', 'De admis'
    RESPINS = 'respins', 'De respins'


class CommissionSession(models.Model):
    """
    O sedinta a comisiei penitenciare. Fiecare sedinta evalueaza
    mai multi condamnati pe mai multe articole.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    session_date = models.DateField(verbose_name='Data sedintei')

    # Derivate din session_date, pt indexare si filtrare rapida
    year = models.PositiveSmallIntegerField(verbose_name='An', editable=False)
    month = models.PositiveSmallIntegerField(verbose_name='Luna', editable=False)

    session_number = models.CharField(
        max_length=100, blank=True,
        verbose_name='Numar sedinta'
    )
    description = models.TextField(blank=True, verbose_name='Descriere')

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_commission_sessions',
        verbose_name='Creat de'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Sedinta comisie'
        verbose_name_plural = 'Sedinte comisie'
        ordering = ['-session_date', '-created_at']
        indexes = [
            models.Index(fields=['session_date']),
            models.Index(fields=['year', 'month']),
            models.Index(fields=['year']),
        ]

    def __str__(self):
        num = f" - {self.session_number}" if self.session_number else ""
        return f"Sedinta din {self.session_date.strftime('%d.%m.%Y')}{num}"

    @property
    def quarter(self):
        """Trimestrul (1-4) pentru aceasta luna."""
        return (self.month - 1) // 3 + 1

    @property
    def evaluations_count(self):
        return self.evaluations.count()

    def save(self, *args, **kwargs):
        if self.session_date:
            self.year = self.session_date.year
            self.month = self.session_date.month
        super().save(*args, **kwargs)


class CommissionEvaluation(models.Model):
    """
    Evaluarea unei persoane condamnate in cadrul unei sedinte.
    O persoana poate fi evaluata pe mai multe articole.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    session = models.ForeignKey(
        CommissionSession,
        on_delete=models.CASCADE,
        related_name='evaluations',
        verbose_name='Sedinta'
    )
    person = models.ForeignKey(
        'persons.ConvictedPerson',
        on_delete=models.CASCADE,
        related_name='commission_evaluations',
        verbose_name='Persoana condamnata'
    )
    notes = models.TextField(blank=True, verbose_name='Observatii')

    class Meta:
        verbose_name = 'Evaluare comisie'
        verbose_name_plural = 'Evaluari comisie'
        unique_together = [['session', 'person']]
        ordering = ['person__last_name', 'person__first_name']
        indexes = [
            models.Index(fields=['person']),
        ]

    def __str__(self):
        return f"{self.person} - {self.session}"


class CommissionArticleResult(models.Model):
    """
    Rezultatul evaluarii pe un articol specific pentru o persoana.
    Include program, comportament si decizie.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    evaluation = models.ForeignKey(
        CommissionEvaluation,
        on_delete=models.CASCADE,
        related_name='article_results',
        verbose_name='Evaluare'
    )

    article = models.CharField(
        max_length=20,
        choices=Article.choices,
        verbose_name='Articol'
    )
    program_result = models.CharField(
        max_length=30,
        choices=ProgramResult.choices,
        verbose_name='Rezultat program'
    )
    behavior_result = models.CharField(
        max_length=10,
        choices=BehaviorResult.choices,
        verbose_name='Rezultat comportament'
    )
    decision = models.CharField(
        max_length=10,
        choices=Decision.choices,
        verbose_name='Decizie'
    )
    notes = models.TextField(blank=True, verbose_name='Observatii')

    class Meta:
        verbose_name = 'Rezultat articol comisie'
        verbose_name_plural = 'Rezultate articole comisie'
        unique_together = [['evaluation', 'article']]
        indexes = [
            models.Index(fields=['article']),
            models.Index(fields=['program_result']),
            models.Index(fields=['behavior_result']),
            models.Index(fields=['decision']),
        ]

    def __str__(self):
        return f"{self.get_article_display()} - {self.evaluation.person}"
