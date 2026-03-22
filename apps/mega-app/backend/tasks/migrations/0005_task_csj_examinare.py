from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0004_monitoremailconfig'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='csj_examinare',
            field=models.BooleanField(default=False, verbose_name='În examinare la CSJ'),
        ),
    ]
