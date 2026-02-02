import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import django.core.validators


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Petition',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('registration_prefix', models.CharField(default='P', max_length=5, verbose_name='Prefix înregistrare')),
                ('registration_seq', models.PositiveIntegerField(verbose_name='Secvență înregistrare')),
                ('registration_year', models.PositiveSmallIntegerField(verbose_name='An înregistrare')),
                ('registration_date', models.DateField(default=django.utils.timezone.now, verbose_name='Data înregistrării')),
                ('petitioner_type', models.CharField(choices=[('condamnat', 'Condamnat'), ('ruda', 'Rudă'), ('avocat', 'Avocat'), ('organ_stat', 'Organ de stat'), ('altul', 'Altul')], max_length=20, verbose_name='Tip petiționar')),
                ('petitioner_name', models.CharField(max_length=255, verbose_name='Nume petiționar')),
                ('detainee_fullname', models.CharField(blank=True, max_length=255, verbose_name='Nume complet deținut')),
                ('object_type', models.CharField(choices=[('art_91', 'Art. 91 (Liberare condiționată)'), ('art_92', 'Art. 92 (Întreruperea executării)'), ('amnistie', 'Amnistie'), ('transfer', 'Transfer'), ('executare', 'Executarea pedepsei'), ('copii_dosar', 'Copii dosar'), ('copii_acte', 'Copii acte'), ('altele', 'Altele')], max_length=20, verbose_name='Tip obiect')),
                ('object_description', models.TextField(blank=True, verbose_name='Descriere obiect')),
                ('status', models.CharField(choices=[('inregistrata', 'Înregistrată'), ('in_examinare', 'În examinare'), ('solutionata', 'Soluționată'), ('respinsa', 'Respinsă'), ('redirectionata', 'Redirecționată')], default='inregistrata', max_length=20, verbose_name='Status')),
                ('resolution_date', models.DateField(blank=True, null=True, verbose_name='Data rezoluției')),
                ('resolution_text', models.TextField(blank=True, verbose_name='Text rezoluție')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_to', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_petitions', to=settings.AUTH_USER_MODEL, verbose_name='Atribuit la')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_petitions', to=settings.AUTH_USER_MODEL, verbose_name='Creat de')),
            ],
            options={
                'verbose_name': 'Petiție',
                'verbose_name_plural': 'Petiții',
                'ordering': ['-registration_date', '-registration_seq'],
                'unique_together': {('registration_prefix', 'registration_seq', 'registration_year')},
            },
        ),
        migrations.AddIndex(
            model_name='petition',
            index=models.Index(fields=['registration_date'], name='petitions_p_registr_7c7b5e_idx'),
        ),
        migrations.AddIndex(
            model_name='petition',
            index=models.Index(fields=['status'], name='petitions_p_status_e93d7d_idx'),
        ),
        migrations.AddIndex(
            model_name='petition',
            index=models.Index(fields=['petitioner_type'], name='petitions_p_petitio_da9d5c_idx'),
        ),
        migrations.AddIndex(
            model_name='petition',
            index=models.Index(fields=['object_type'], name='petitions_p_object__7cfedb_idx'),
        ),
        migrations.CreateModel(
            name='PetitionAttachment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('file', models.FileField(upload_to='attachments/', validators=[django.core.validators.FileExtensionValidator(allowed_extensions=['pdf', 'jpg', 'jpeg', 'png'])], verbose_name='Fișier')),
                ('original_filename', models.CharField(max_length=255, verbose_name='Nume original fișier')),
                ('size_bytes', models.PositiveIntegerField(verbose_name='Dimensiune (bytes)')),
                ('content_type', models.CharField(max_length=100, verbose_name='Tip conținut')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('petition', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='petitions.petition', verbose_name='Petiție')),
                ('uploaded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name='Încărcat de')),
            ],
            options={
                'verbose_name': 'Fișier atașat',
                'verbose_name_plural': 'Fișiere atașate',
                'ordering': ['-uploaded_at'],
            },
        ),
    ]
