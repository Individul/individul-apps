from django.db import migrations, models


def migrate_old_statuses(apps, schema_editor):
    """Migrate old status values to new ones."""
    Sentence = apps.get_model('sentences', 'Sentence')
    # suspended -> cumulated
    Sentence.objects.filter(status='suspended').update(status='cumulated')
    # completed -> cumulated
    Sentence.objects.filter(status='completed').update(status='cumulated')
    # conditionally_released -> cumulated
    Sentence.objects.filter(status='conditionally_released').update(status='cumulated')


class Migration(migrations.Migration):

    dependencies = [
        ('sentences', '0003_preventivearrest'),
    ]

    operations = [
        # First migrate existing data
        migrations.RunPython(migrate_old_statuses, migrations.RunPython.noop),
        # Then change the field choices
        migrations.AlterField(
            model_name='sentence',
            name='status',
            field=models.CharField(
                choices=[('active', 'Activă'), ('cumulated', 'Cumulată'), ('new', 'Nouă')],
                default='active',
                max_length=25,
                verbose_name='Status',
            ),
        ),
    ]
