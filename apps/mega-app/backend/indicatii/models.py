import uuid
from django.db import models
from django.conf import settings


class Indicatie(models.Model):
    class Prioritate(models.TextChoices):
        URGENT = 'URGENT', 'Urgent'
        NORMAL = 'NORMAL', 'Normal'
        SCAZUT = 'SCAZUT', 'Scăzut'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    titlu = models.CharField(max_length=255)
    descriere = models.TextField(blank=True)
    prioritate = models.CharField(
        max_length=20,
        choices=Prioritate.choices,
        default=Prioritate.NORMAL
    )
    termen_limita = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='indicatii_create'
    )
    persoana_legata = models.ForeignKey(
        'persons.ConvictedPerson',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='indicatii'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.titlu


class IndicatieDestinatari(models.Model):
    class Status(models.TextChoices):
        NOU = 'NOU', 'Nou'
        IN_LUCRU = 'IN_LUCRU', 'În lucru'
        INDEPLINIT = 'INDEPLINIT', 'Îndeplinit'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    indicatie = models.ForeignKey(
        Indicatie,
        on_delete=models.CASCADE,
        related_name='destinatari'
    )
    destinatar = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='indicatii_primite'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NOU
    )
    data_indeplinire = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['destinatar__first_name']
        unique_together = [('indicatie', 'destinatar')]

    def __str__(self):
        return f"{self.indicatie.titlu} -> {self.destinatar}"


class IndicatieComentariu(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    indicatie = models.ForeignKey(
        Indicatie,
        on_delete=models.CASCADE,
        related_name='comentarii'
    )
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='indicatii_comentarii'
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comentariu de {self.autor} la {self.indicatie.titlu}"


class IndicatieFisier(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    indicatie = models.ForeignKey(
        Indicatie,
        on_delete=models.CASCADE,
        related_name='fisiere'
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='indicatii_fisiere'
    )
    fisier = models.FileField(upload_to='indicatii/')
    nume_fisier = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.nume_fisier
