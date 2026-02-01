import uuid
from django.db import models
from django.contrib.auth.models import User


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
        User,
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
        User,
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
