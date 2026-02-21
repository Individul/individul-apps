import uuid
from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    class ActionType(models.TextChoices):
        CREATE = 'create', 'Creare'
        UPDATE = 'update', 'Actualizare'
        DELETE = 'delete', 'Ștergere'
        STATUS_CHANGE = 'status_change', 'Schimbare status'
        UPLOAD = 'upload', 'Încărcare fișier'
        LOGIN = 'login', 'Autentificare'
        LOGOUT = 'logout', 'Deconectare'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs',
        verbose_name='Actor'
    )
    actor_username = models.CharField(
        max_length=150,
        verbose_name='Username actor'
    )
    action = models.CharField(
        max_length=50,
        choices=ActionType.choices,
        verbose_name='Acțiune'
    )
    entity_type = models.CharField(
        max_length=100,
        verbose_name='Tip entitate'
    )
    entity_id = models.CharField(
        max_length=100,
        verbose_name='ID entitate'
    )
    before_json = models.JSONField(
        null=True,
        blank=True,
        verbose_name='Stare înainte'
    )
    after_json = models.JSONField(
        null=True,
        blank=True,
        verbose_name='Stare după'
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name='Adresă IP'
    )
    user_agent = models.TextField(
        blank=True,
        verbose_name='User Agent'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Data și ora'
    )

    class Meta:
        verbose_name = 'Jurnal audit'
        verbose_name_plural = 'Jurnale audit'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['actor']),
            models.Index(fields=['action']),
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.actor_username} - {self.get_action_display()} - {self.entity_type}:{self.entity_id}"

    @property
    def changes(self):
        """Return a dict of changed fields."""
        if not self.before_json or not self.after_json:
            return {}

        changes = {}
        all_keys = set(self.before_json.keys()) | set(self.after_json.keys())

        for key in all_keys:
            before_val = self.before_json.get(key)
            after_val = self.after_json.get(key)
            if before_val != after_val:
                changes[key] = {'before': before_val, 'after': after_val}

        return changes
