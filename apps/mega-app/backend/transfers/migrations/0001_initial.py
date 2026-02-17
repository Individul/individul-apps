import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def migrate_old_data(apps, schema_editor):
    """Migreaza datele din tabelul vechi transfers_monthlytransfer in noile tabele."""
    from django.db import connection
    cursor = connection.cursor()

    # Verificam daca tabelul vechi exista
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'transfers_monthlytransfer'
        );
    """)
    old_table_exists = cursor.fetchone()[0]

    if not old_table_exists:
        return

    # Citim datele vechi, grupate pe (year, month)
    cursor.execute("""
        SELECT DISTINCT year, month FROM transfers_monthlytransfer ORDER BY year, month;
    """)
    periods = cursor.fetchall()

    if not periods:
        # Stergem tabelul vechi daca e gol
        cursor.execute("DROP TABLE IF EXISTS transfers_monthlytransfer;")
        return

    for year, month in periods:
        # Cream un Transfer header cu data = prima zi a lunii
        transfer_id = str(uuid.uuid4())
        transfer_date = f"{year}-{month:02d}-01"

        # Luam created_by din primul rand care are created_by
        cursor.execute("""
            SELECT created_by_id FROM transfers_monthlytransfer
            WHERE year = %s AND month = %s AND created_by_id IS NOT NULL
            LIMIT 1;
        """, [year, month])
        row = cursor.fetchone()
        created_by_id = row[0] if row else None

        cursor.execute("""
            INSERT INTO transfers_transfer (id, transfer_date, year, month, description, created_by_id, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW());
        """, [transfer_id, transfer_date, year, month, f'Migrat din date lunare {month:02d}/{year}', created_by_id])

        # Citim toate randurile pentru aceasta luna
        cursor.execute("""
            SELECT id, penitentiary, veniti, veniti_reintorsi, veniti_noi, plecati, plecati_izolator, notes
            FROM transfers_monthlytransfer
            WHERE year = %s AND month = %s;
        """, [year, month])
        entries = cursor.fetchall()

        for entry in entries:
            entry_id = str(uuid.uuid4())
            _, penitentiary, veniti, veniti_reintorsi, veniti_noi, plecati, plecati_izolator, notes = entry
            cursor.execute("""
                INSERT INTO transfers_transferentry (id, transfer_id, penitentiary, veniti, veniti_reintorsi, veniti_noi, plecati, plecati_izolator, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, [entry_id, transfer_id, penitentiary, veniti, veniti_reintorsi, veniti_noi, plecati, plecati_izolator, notes or ''])

    # Stergem tabelul vechi
    cursor.execute("DROP TABLE IF EXISTS transfers_monthlytransfer;")


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Transfer',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('transfer_date', models.DateField(verbose_name='Data transferului')),
                ('year', models.PositiveSmallIntegerField(editable=False, verbose_name='An')),
                ('month', models.PositiveSmallIntegerField(editable=False, verbose_name='Luna')),
                ('description', models.TextField(blank=True, verbose_name='Descriere')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_transfers',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Creat de',
                )),
            ],
            options={
                'verbose_name': 'Transfer',
                'verbose_name_plural': 'Transferuri',
                'ordering': ['-transfer_date', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TransferEntry',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('penitentiary', models.PositiveSmallIntegerField(
                    choices=[
                        (1, 'Penitenciarul nr. 1'), (2, 'Penitenciarul nr. 2'),
                        (3, 'Penitenciarul nr. 3'), (4, 'Penitenciarul nr. 4'),
                        (5, 'Penitenciarul nr. 5'), (6, 'Penitenciarul nr. 6'),
                        (7, 'Penitenciarul nr. 7'), (8, 'Penitenciarul nr. 8'),
                        (9, 'Penitenciarul nr. 9'), (10, 'Penitenciarul nr. 10'),
                        (11, 'Penitenciarul nr. 11 (Izolator)'), (12, 'Penitenciarul nr. 12'),
                        (13, 'Penitenciarul nr. 13 (Izolator)'), (15, 'Penitenciarul nr. 15'),
                        (16, 'Penitenciarul nr. 16'), (17, 'Penitenciarul nr. 17'),
                        (18, 'Penitenciarul nr. 18'),
                    ],
                    verbose_name='Penitenciar',
                )),
                ('veniti', models.PositiveIntegerField(default=0, verbose_name='Veniti (total)')),
                ('veniti_reintorsi', models.PositiveIntegerField(default=0, verbose_name='Veniti - reintorsi')),
                ('veniti_noi', models.PositiveIntegerField(default=0, verbose_name='Veniti - noi')),
                ('plecati', models.PositiveIntegerField(default=0, verbose_name='Plecati (total)')),
                ('plecati_izolator', models.PositiveIntegerField(default=0, verbose_name='Plecati la izolator')),
                ('notes', models.TextField(blank=True, verbose_name='Observatii')),
                ('transfer', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='entries',
                    to='transfers.transfer',
                    verbose_name='Transfer',
                )),
            ],
            options={
                'verbose_name': 'Rand transfer',
                'verbose_name_plural': 'Randuri transfer',
                'ordering': ['penitentiary'],
            },
        ),
        # Indexes
        migrations.AddIndex(
            model_name='transfer',
            index=models.Index(fields=['transfer_date'], name='transfers_t_transfe_idx'),
        ),
        migrations.AddIndex(
            model_name='transfer',
            index=models.Index(fields=['year', 'month'], name='transfers_t_year_mo_idx'),
        ),
        migrations.AddIndex(
            model_name='transfer',
            index=models.Index(fields=['year'], name='transfers_t_year_idx'),
        ),
        migrations.AddIndex(
            model_name='transferentry',
            index=models.Index(fields=['penitentiary'], name='transfers_e_penit_idx'),
        ),
        # Unique constraint
        migrations.AlterUniqueTogether(
            name='transferentry',
            unique_together={('transfer', 'penitentiary')},
        ),
        # Data migration: move old data from transfers_monthlytransfer to new tables
        migrations.RunPython(migrate_old_data, migrations.RunPython.noop),
    ]
