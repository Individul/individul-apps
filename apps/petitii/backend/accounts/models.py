from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        VIEWER = 'viewer', 'Vizualizator'
        OPERATOR = 'operator', 'Operator'
        ADMIN = 'admin', 'Administrator'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.VIEWER,
        verbose_name='Rol'
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Telefon'
    )
    department = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Departament'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Utilizator'
        verbose_name_plural = 'Utilizatori'
        ordering = ['username']

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_operator(self):
        return self.role in [self.Role.OPERATOR, self.Role.ADMIN] or self.is_superuser

    @property
    def can_edit_petitions(self):
        return self.is_operator

    @property
    def can_manage_users(self):
        return self.is_admin
