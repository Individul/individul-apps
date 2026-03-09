import uuid
from django.db import models
from django.conf import settings


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = 'TODO', 'To Do'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        DONE = 'DONE', 'Done'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'

    class Category(models.TextChoices):
        CUMULARE = 'CUMULARE', 'Cumulare'
        AREST_PREVENTIV = 'AREST_PREVENTIV', 'Arest preventiv'
        NECLARITATI = 'NECLARITATI', 'Neclarități'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TODO
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM
    )
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        blank=True
    )
    tags = models.JSONField(default=list, blank=True)
    deadline = models.DateField(null=True, blank=True)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class TaskActivity(models.Model):
    class ActionType(models.TextChoices):
        CREATED = 'CREATED', 'Creat'
        UPDATED = 'UPDATED', 'Actualizat'
        STATUS_CHANGED = 'STATUS_CHANGED', 'Status schimbat'
        PRIORITY_CHANGED = 'PRIORITY_CHANGED', 'Prioritate schimbată'
        ASSIGNED = 'ASSIGNED', 'Atribuit'
        UNASSIGNED = 'UNASSIGNED', 'Dezatribuit'
        COMMENT = 'COMMENT', 'Comentariu'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='activities')
    action = models.CharField(max_length=20, choices=ActionType.choices)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='task_activities'
    )
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Task activities'

    def __str__(self):
        return f"{self.task.title} - {self.action}"


class MonitorEmailConfig(models.Model):
    smtp_host = models.CharField(max_length=255, default='smtp', blank=True)
    smtp_port = models.IntegerField(default=25)
    smtp_user = models.CharField(max_length=255, default='', blank=True)
    smtp_password = models.CharField(max_length=255, default='', blank=True)
    smtp_use_tls = models.BooleanField(default=False)
    email_from = models.EmailField(default='', blank=True)
    email_to = models.TextField(help_text='Adrese email separate prin virgula', default='', blank=True)
    enabled = models.BooleanField(default=False)
    last_sent = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(default='', blank=True)

    class Meta:
        verbose_name = 'Configurare Email Monitor'
        verbose_name_plural = 'Configurare Email Monitor'

    def save(self, *args, **kwargs):
        # Singleton pattern - ensure only one instance
        if not self.pk and MonitorEmailConfig.objects.exists():
            raise ValueError('Poate exista doar o singura configurare email')
        super().save(*args, **kwargs)

    @classmethod
    def get_config(cls):
        config, _ = cls.objects.get_or_create(pk=1)
        return config

    def __str__(self):
        return f'Email Config ({"activ" if self.enabled else "inactiv"})'
