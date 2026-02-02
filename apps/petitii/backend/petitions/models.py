import uuid
import os
from datetime import timedelta
from django.db import models
from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.utils import timezone


def attachment_upload_path(instance, filename):
    """Generate upload path for attachments."""
    ext = filename.split('.')[-1]
    new_filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('attachments', str(instance.petition.id), new_filename)


class Petition(models.Model):
    class PetitionerType(models.TextChoices):
        CONDAMNAT = 'condamnat', 'Condamnat'
        RUDA = 'ruda', 'Rudă'
        AVOCAT = 'avocat', 'Avocat'
        ORGAN_STAT = 'organ_stat', 'Organ de stat'
        ALTUL = 'altul', 'Altul'

    class ObjectType(models.TextChoices):
        ART_91 = 'art_91', 'Art. 91 (Liberare condiționată)'
        ART_92 = 'art_92', 'Art. 92 (Întreruperea executării)'
        AMNISTIE = 'amnistie', 'Amnistie'
        TRANSFER = 'transfer', 'Transfer'
        EXECUTARE = 'executare', 'Executarea pedepsei'
        COPII_DOSAR = 'copii_dosar', 'Copii dosar'
        COPII_ACTE = 'copii_acte', 'Copii acte'
        ALTELE = 'altele', 'Altele'

    class Status(models.TextChoices):
        INREGISTRATA = 'inregistrata', 'Înregistrată'
        IN_EXAMINARE = 'in_examinare', 'În examinare'
        SOLUTIONATA = 'solutionata', 'Soluționată'
        RESPINSA = 'respinsa', 'Respinsă'
        REDIRECTIONATA = 'redirectionata', 'Redirecționată'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Registration fields
    registration_prefix = models.CharField(
        max_length=5,
        default='P',
        verbose_name='Prefix înregistrare'
    )
    registration_seq = models.PositiveIntegerField(
        verbose_name='Secvență înregistrare'
    )
    registration_year = models.PositiveSmallIntegerField(
        verbose_name='An înregistrare'
    )
    registration_date = models.DateField(
        default=timezone.now,
        verbose_name='Data înregistrării'
    )

    # Petitioner info
    petitioner_type = models.CharField(
        max_length=20,
        choices=PetitionerType.choices,
        verbose_name='Tip petiționar'
    )
    petitioner_name = models.CharField(
        max_length=255,
        verbose_name='Nume petiționar'
    )
    detainee_fullname = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Nume complet deținut'
    )

    # Petition details
    object_type = models.CharField(
        max_length=20,
        choices=ObjectType.choices,
        verbose_name='Tip obiect'
    )
    object_description = models.TextField(
        blank=True,
        verbose_name='Descriere obiect'
    )

    # Status and assignment
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.INREGISTRATA,
        verbose_name='Status'
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_petitions',
        verbose_name='Atribuit la'
    )

    # Resolution
    resolution_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Data rezoluției'
    )
    resolution_text = models.TextField(
        blank=True,
        verbose_name='Text rezoluție'
    )

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_petitions',
        verbose_name='Creat de'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Petiție'
        verbose_name_plural = 'Petiții'
        ordering = ['-registration_date', '-registration_seq']
        unique_together = [['registration_prefix', 'registration_seq', 'registration_year']]
        indexes = [
            models.Index(fields=['registration_date']),
            models.Index(fields=['status']),
            models.Index(fields=['petitioner_type']),
            models.Index(fields=['object_type']),
        ]

    def __str__(self):
        return self.registration_number

    @property
    def registration_number(self):
        """Generate registration number format: PREFIX-SEQ/YY"""
        year_short = str(self.registration_year)[-2:]
        return f"{self.registration_prefix}-{self.registration_seq}/{year_short}"

    @property
    def response_due_date(self):
        """Calculate response due date (registration_date + 12 days)."""
        days = getattr(settings, 'PETITION_RESPONSE_DAYS', 12)
        return self.registration_date + timedelta(days=days)

    @property
    def is_overdue(self):
        """Check if petition is overdue."""
        if self.status == self.Status.SOLUTIONATA:
            return False
        return timezone.now().date() > self.response_due_date

    @property
    def is_due_soon(self):
        """Check if petition is due within 3 days."""
        if self.status == self.Status.SOLUTIONATA:
            return False
        days = getattr(settings, 'PETITION_DUE_SOON_DAYS', 3)
        return (
            not self.is_overdue and
            (self.response_due_date - timezone.now().date()).days <= days
        )

    @property
    def days_until_due(self):
        """Calculate days until due date."""
        return (self.response_due_date - timezone.now().date()).days

    def save(self, *args, **kwargs):
        if not self.registration_seq:
            # Auto-generate sequence number
            year = self.registration_date.year if self.registration_date else timezone.now().year
            self.registration_year = year
            last_petition = Petition.objects.filter(
                registration_prefix=self.registration_prefix,
                registration_year=year
            ).order_by('-registration_seq').first()
            self.registration_seq = (last_petition.registration_seq + 1) if last_petition else 1
        super().save(*args, **kwargs)


class PetitionAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    petition = models.ForeignKey(
        Petition,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='Petiție'
    )
    file = models.FileField(
        upload_to=attachment_upload_path,
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'jpg', 'jpeg', 'png'])],
        verbose_name='Fișier'
    )
    original_filename = models.CharField(
        max_length=255,
        verbose_name='Nume original fișier'
    )
    size_bytes = models.PositiveIntegerField(
        verbose_name='Dimensiune (bytes)'
    )
    content_type = models.CharField(
        max_length=100,
        verbose_name='Tip conținut'
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Încărcat de'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Fișier atașat'
        verbose_name_plural = 'Fișiere atașate'
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.original_filename

    def save(self, *args, **kwargs):
        if self.file:
            if not self.original_filename:
                self.original_filename = self.file.name
            if not self.size_bytes:
                self.size_bytes = self.file.size
        super().save(*args, **kwargs)
