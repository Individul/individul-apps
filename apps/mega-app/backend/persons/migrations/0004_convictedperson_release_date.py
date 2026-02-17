from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('persons', '0003_convictedperson_mai_notification'),
    ]

    operations = [
        migrations.AddField(
            model_name='convictedperson',
            name='release_date',
            field=models.DateField(blank=True, null=True, verbose_name='Data eliberarii'),
        ),
        migrations.AddIndex(
            model_name='convictedperson',
            index=models.Index(fields=['release_date'], name='persons_con_release_9fe39a_idx'),
        ),
    ]
