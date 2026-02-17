import uuid
from django.db import models
from django.conf import settings


class Alert(models.Model):
    class AlertType(models.TextChoices):
        IMMINENT = 'imminent', 'Iminent (≤30 zile)'
        UPCOMING = 'upcoming', 'În curând (30-90 zile)'
        OVERDUE = 'overdue', 'Depășit'
        FULFILLED = 'fulfilled', 'Îndeplinit'

    class Priority(models.TextChoices):
        HIGH = 'high', 'Ridicată'
        MEDIUM = 'medium', 'Medie'
        LOW = 'low', 'Scăzută'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='alerts',
        verbose_name='Utilizator'
    )
    alert_type = models.CharField(
        max_length=20,
        choices=AlertType.choices,
        verbose_name='Tip alertă'
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        verbose_name='Prioritate'
    )
    fraction = models.ForeignKey(
        'sentences.Fraction',
        on_delete=models.CASCADE,
        related_name='alerts',
        verbose_name='Fracție'
    )
    person = models.ForeignKey(
        'persons.ConvictedPerson',
        on_delete=models.CASCADE,
        related_name='alerts',
        verbose_name='Persoană'
    )
    message = models.TextField(
        verbose_name='Mesaj'
    )
    target_date = models.DateField(
        verbose_name='Data țintă'
    )
    is_read = models.BooleanField(
        default=False,
        verbose_name='Citită'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Creat la')

    class Meta:
        verbose_name = 'Alertă'
        verbose_name_plural = 'Alerte'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['alert_type']),
            models.Index(fields=['target_date']),
        ]

    def __str__(self):
        return f"{self.get_alert_type_display()} - {self.person.full_name} ({self.target_date})"
