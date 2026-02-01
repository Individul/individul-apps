from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Create initial users for Task Manager'

    def handle(self, *args, **options):
        users_data = [
            {'username': 'dprisacaru', 'first_name': 'Dumitru', 'last_name': 'Prisacaru'},
            {'username': 'agutu', 'first_name': 'Ana', 'last_name': 'Gutu'},
            {'username': 'nspinei', 'first_name': 'Natalia', 'last_name': 'Spinei'},
            {'username': 'acojocari', 'first_name': 'Ana', 'last_name': 'Cojocari'},
        ]

        for data in users_data:
            user, created = User.objects.get_or_create(
                username=data['username'],
                defaults={
                    'first_name': data['first_name'],
                    'last_name': data['last_name'],
                }
            )
            if created:
                user.set_password('password123')
                user.save()
                self.stdout.write(self.style.SUCCESS(f"Created user: {data['first_name']} {data['last_name']}"))
            else:
                self.stdout.write(f"User already exists: {data['first_name']} {data['last_name']}")

        self.stdout.write(self.style.SUCCESS('Done!'))
