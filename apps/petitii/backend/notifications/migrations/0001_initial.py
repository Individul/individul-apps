import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('petitions', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('type', models.CharField(choices=[('due_soon', 'Termen apropiat'), ('overdue', 'Termen depășit'), ('assigned', 'Petiție atribuită'), ('status_changed', 'Status modificat')], max_length=20, verbose_name='Tip')),
                ('message', models.TextField(verbose_name='Mesaj')),
                ('due_date', models.DateField(blank=True, null=True, verbose_name='Data termen')),
                ('is_read', models.BooleanField(default=False, verbose_name='Citită')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('petition', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='petitions.petition', verbose_name='Petiție')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL, verbose_name='Utilizator')),
            ],
            options={
                'verbose_name': 'Notificare',
                'verbose_name_plural': 'Notificări',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['user', 'is_read'], name='notificatio_user_id_8c9c5e_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['type'], name='notificatio_type_e60c9e_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['created_at'], name='notificatio_created_bc28c9_idx'),
        ),
    ]
