import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='BotNotificationLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('notification_type', models.CharField(
                    choices=[
                        ('fraction_overdue', 'Fracție depășită'),
                        ('fraction_imminent', 'Fracție iminentă'),
                        ('petition_overdue', 'Petiție depășită'),
                        ('petition_due_soon', 'Petiție scadentă'),
                    ],
                    max_length=30,
                    verbose_name='Tip notificare',
                )),
                ('entity_id', models.UUIDField(verbose_name='ID entitate')),
                ('sent_at', models.DateTimeField(auto_now_add=True, verbose_name='Trimis la')),
                ('message_preview', models.CharField(blank=True, max_length=200, verbose_name='Preview mesaj')),
            ],
            options={
                'verbose_name': 'Log notificare bot',
                'verbose_name_plural': 'Log notificări bot',
                'ordering': ['-sent_at'],
            },
        ),
        migrations.AddIndex(
            model_name='botnotificationlog',
            index=models.Index(fields=['notification_type', 'entity_id'], name='bot_botnoti_notific_idx'),
        ),
        migrations.AddIndex(
            model_name='botnotificationlog',
            index=models.Index(fields=['sent_at'], name='bot_botnoti_sent_at_idx'),
        ),
    ]
