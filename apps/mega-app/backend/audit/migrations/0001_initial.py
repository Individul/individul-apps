import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('actor_username', models.CharField(max_length=150, verbose_name='Username actor')),
                ('action', models.CharField(choices=[('create', 'Creare'), ('update', 'Actualizare'), ('delete', 'Ștergere'), ('status_change', 'Schimbare status'), ('upload', 'Încărcare fișier'), ('login', 'Autentificare'), ('logout', 'Deconectare')], max_length=20, verbose_name='Acțiune')),
                ('entity_type', models.CharField(max_length=100, verbose_name='Tip entitate')),
                ('entity_id', models.CharField(max_length=100, verbose_name='ID entitate')),
                ('before_json', models.JSONField(blank=True, null=True, verbose_name='Stare înainte')),
                ('after_json', models.JSONField(blank=True, null=True, verbose_name='Stare după')),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True, verbose_name='Adresă IP')),
                ('user_agent', models.TextField(blank=True, verbose_name='User Agent')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Data și ora')),
                ('actor', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_logs', to=settings.AUTH_USER_MODEL, verbose_name='Actor')),
            ],
            options={
                'verbose_name': 'Jurnal audit',
                'verbose_name_plural': 'Jurnale audit',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['actor'], name='audit_audit_actor_i_8defa1_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['action'], name='audit_audit_action_e97c80_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['entity_type', 'entity_id'], name='audit_audit_entity__4c1c1e_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['created_at'], name='audit_audit_created_9f46ae_idx'),
        ),
    ]
