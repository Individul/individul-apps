from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sentences', '0005_zpm'),
    ]

    operations = [
        migrations.AlterField(
            model_name='sentence',
            name='status',
            field=models.CharField(
                choices=[('active', 'Activă'), ('cumulated', 'Cumulată'), ('new', 'Nouă'), ('finished', 'Finalizată')],
                default='active',
                max_length=25,
                verbose_name='Status',
            ),
        ),
    ]
