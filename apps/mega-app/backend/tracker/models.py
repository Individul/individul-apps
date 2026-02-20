import uuid
from django.db import models
from django.conf import settings


class Issue(models.Model):
    class Category(models.TextChoices):
        BUG_CRITIC = 'BUG_CRITIC', 'Bug critic'
        BUG_MINOR = 'BUG_MINOR', 'Bug minor'
        PROPUNERE = 'PROPUNERE', 'Propunere de îmbunătățire'
        CERINTA_NOUA = 'CERINTA_NOUA', 'Cerință nouă'

    class Priority(models.TextChoices):
        CRITIC = 'CRITIC', 'Critic'
        INALT = 'INALT', 'Înalt'
        MEDIU = 'MEDIU', 'Mediu'
        SCAZUT = 'SCAZUT', 'Scăzut'

    class Status(models.TextChoices):
        NOU = 'NOU', 'Nou'
        IN_LUCRU = 'IN_LUCRU', 'În lucru'
        TESTAT = 'TESTAT', 'Testat'
        IMPLEMENTAT = 'IMPLEMENTAT', 'Implementat'
        RESPINS = 'RESPINS', 'Respins'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=500, verbose_name='Titlu')
    description = models.TextField(blank=True, verbose_name='Descriere')
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        verbose_name='Categorie'
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIU,
        verbose_name='Prioritate'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NOU,
        verbose_name='Status'
    )
    module_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Modulul afectat',
        help_text='Numele modulului/componentei SIA afectate'
    )
    steps_to_reproduce = models.TextField(
        blank=True,
        verbose_name='Pași de reproducere',
    )
    expected_behavior = models.TextField(
        blank=True,
        verbose_name='Comportament așteptat'
    )
    actual_behavior = models.TextField(
        blank=True,
        verbose_name='Comportament actual'
    )
    resolution_notes = models.TextField(
        blank=True,
        verbose_name='Note rezolvare'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tracker_issues',
        verbose_name='Creat de'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Problemă'
        verbose_name_plural = 'Probleme'

    def __str__(self):
        return f"[{self.get_category_display()}] {self.title}"
