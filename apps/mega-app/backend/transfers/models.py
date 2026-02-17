import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


class Penitentiary(models.IntegerChoices):
    """Toate penitenciarele din sistem. Nr. 14 nu exista."""
    P_1 = 1, 'Penitenciarul nr. 1'
    P_2 = 2, 'Penitenciarul nr. 2'
    P_3 = 3, 'Penitenciarul nr. 3'
    P_4 = 4, 'Penitenciarul nr. 4'
    P_5 = 5, 'Penitenciarul nr. 5'
    P_6 = 6, 'Penitenciarul nr. 6'
    P_7 = 7, 'Penitenciarul nr. 7'
    P_8 = 8, 'Penitenciarul nr. 8'
    P_9 = 9, 'Penitenciarul nr. 9'
    P_10 = 10, 'Penitenciarul nr. 10'
    P_11 = 11, 'Penitenciarul nr. 11 (Izolator)'
    P_12 = 12, 'Penitenciarul nr. 12'
    P_13 = 13, 'Penitenciarul nr. 13 (Izolator)'
    P_15 = 15, 'Penitenciarul nr. 15'
    P_16 = 16, 'Penitenciarul nr. 16'
    P_17 = 17, 'Penitenciarul nr. 17'
    P_18 = 18, 'Penitenciarul nr. 18'


# Penitenciarele altele decat P-6 (al nostru)
OTHER_PENITENTIARIES = [p for p in Penitentiary if p != Penitentiary.P_6]

# Izolatoarele
ISOLATOR_PENITENTIARIES = [Penitentiary.P_11, Penitentiary.P_13]

ISOLATOR_VALUES = [p.value for p in ISOLATOR_PENITENTIARIES]


class Transfer(models.Model):
    """
    Un eveniment de transfer (o sesiune de transferuri pe o anumita data).
    Pot exista multiple transferuri pe luna. Fiecare transfer contine
    randuri (TransferEntry) per penitenciar.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    transfer_date = models.DateField(verbose_name='Data transferului')

    # Derivate din transfer_date, pt indexare si filtrare rapida
    year = models.PositiveSmallIntegerField(verbose_name='An', editable=False)
    month = models.PositiveSmallIntegerField(verbose_name='Luna', editable=False)

    # Descriere optionala
    description = models.TextField(blank=True, verbose_name='Descriere')

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_transfers',
        verbose_name='Creat de'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Transfer'
        verbose_name_plural = 'Transferuri'
        ordering = ['-transfer_date', '-created_at']
        indexes = [
            models.Index(fields=['transfer_date']),
            models.Index(fields=['year', 'month']),
            models.Index(fields=['year']),
        ]

    def __str__(self):
        return f"Transfer din {self.transfer_date.strftime('%d.%m.%Y')}"

    @property
    def quarter(self):
        """Trimestrul (1-4) pentru aceasta luna."""
        return (self.month - 1) // 3 + 1

    def save(self, *args, **kwargs):
        if self.transfer_date:
            self.year = self.transfer_date.year
            self.month = self.transfer_date.month
        super().save(*args, **kwargs)

    def clean(self):
        if self.transfer_date and self.transfer_date.year < 2000:
            raise ValidationError({
                'transfer_date': 'Data trebuie sa fie dupa anul 2000.'
            })


class TransferEntry(models.Model):
    """
    Un rand de date pentru un penitenciar intr-un transfer.
    Inregistreaza transferurile intre P-6 si un alt penitenciar.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    transfer = models.ForeignKey(
        Transfer,
        on_delete=models.CASCADE,
        related_name='entries',
        verbose_name='Transfer'
    )

    penitentiary = models.PositiveSmallIntegerField(
        choices=Penitentiary.choices,
        verbose_name='Penitenciar'
    )

    # Veniti (la P-6 din acest penitenciar)
    veniti = models.PositiveIntegerField(default=0, verbose_name='Veniti (total)')
    veniti_reintorsi = models.PositiveIntegerField(default=0, verbose_name='Veniti - reintorsi')
    veniti_noi = models.PositiveIntegerField(default=0, verbose_name='Veniti - noi')

    # Plecati (de la P-6 catre acest penitenciar)
    plecati = models.PositiveIntegerField(default=0, verbose_name='Plecati (total)')
    plecati_izolator = models.PositiveIntegerField(default=0, verbose_name='Plecati la izolator')

    # Observatii
    notes = models.TextField(blank=True, verbose_name='Observatii')

    class Meta:
        verbose_name = 'Rand transfer'
        verbose_name_plural = 'Randuri transfer'
        ordering = ['penitentiary']
        unique_together = [['transfer', 'penitentiary']]
        indexes = [
            models.Index(fields=['penitentiary']),
        ]

    def __str__(self):
        return f"{self.get_penitentiary_display()} - {self.transfer}"

    @property
    def is_isolator(self):
        """Daca penitenciarul este un izolator."""
        return self.penitentiary in ISOLATOR_VALUES

    def clean(self):
        errors = {}
        if self.penitentiary == Penitentiary.P_6:
            errors['penitentiary'] = 'Nu se pot inregistra transferuri catre propriul penitenciar (P-6).'
        if self.veniti != self.veniti_reintorsi + self.veniti_noi:
            errors['veniti'] = 'Total veniti trebuie sa fie egal cu reintorsi + noi.'
        if self.plecati_izolator > 0 and self.penitentiary not in ISOLATOR_VALUES:
            errors['plecati_izolator'] = 'Plecati la izolator se completeaza doar pentru P-11 si P-13.'
        if errors:
            raise ValidationError(errors)
