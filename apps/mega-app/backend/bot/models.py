import uuid
from django.db import models


class BotNotificationLog(models.Model):
    """Tracks sent Telegram notifications to avoid duplicates."""

    class NotificationType(models.TextChoices):
        FRACTION_OVERDUE = 'fraction_overdue', 'Fracție depășită'
        FRACTION_IMMINENT = 'fraction_imminent', 'Fracție iminentă'
        PETITION_OVERDUE = 'petition_overdue', 'Petiție depășită'
        PETITION_DUE_SOON = 'petition_due_soon', 'Petiție scadentă'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        verbose_name='Tip notificare'
    )
    entity_id = models.UUIDField(verbose_name='ID entitate')
    sent_at = models.DateTimeField(auto_now_add=True, verbose_name='Trimis la')
    message_preview = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Preview mesaj'
    )

    class Meta:
        verbose_name = 'Log notificare bot'
        verbose_name_plural = 'Log notificări bot'
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['notification_type', 'entity_id']),
            models.Index(fields=['sent_at']),
        ]

    def __str__(self):
        return f"{self.get_notification_type_display()} - {self.entity_id} ({self.sent_at})"
