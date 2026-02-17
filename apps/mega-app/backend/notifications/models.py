import uuid
from django.db import models
from django.conf import settings


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        DUE_SOON = 'due_soon', 'Termen apropiat'
        OVERDUE = 'overdue', 'Termen depășit'
        ASSIGNED = 'assigned', 'Petiție atribuită'
        STATUS_CHANGED = 'status_changed', 'Status modificat'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name='Utilizator'
    )
    type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        verbose_name='Tip'
    )
    petition = models.ForeignKey(
        'petitions.Petition',
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name='Petiție'
    )
    message = models.TextField(verbose_name='Mesaj')
    due_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Data termen'
    )
    is_read = models.BooleanField(
        default=False,
        verbose_name='Citită'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Notificare'
        verbose_name_plural = 'Notificări'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.get_type_display()} - {self.petition.registration_number}"
