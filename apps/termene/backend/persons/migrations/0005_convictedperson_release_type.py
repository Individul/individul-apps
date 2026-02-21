from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('persons', '0004_convictedperson_release_date'),
    ]

    operations = [
        migrations.AddField(
            model_name='convictedperson',
            name='release_type',
            field=models.CharField(
                blank=True,
                choices=[('full_term', 'Executarea integrală'), ('art_91', 'Art. 91'), ('art_92', 'Art. 92'), ('conditions', 'Condiții')],
                default='',
                max_length=20,
                verbose_name='Modalitatea eliberării',
            ),
        ),
    ]
