from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Create initial users for Mega App'

    def handle(self, *args, **options):
        users_data = [
            {'username': 'admin', 'first_name': 'Dumitru', 'last_name': 'Prisacaru', 'role': 'admin'},
            {'username': 'agutu', 'first_name': 'Ana', 'last_name': 'Gutu', 'role': 'operator'},
            {'username': 'nspinei', 'first_name': 'Natalia', 'last_name': 'Spinei', 'role': 'operator'},
            {'username': 'acojocari', 'first_name': 'Ana', 'last_name': 'Cojocari', 'role': 'operator'},
        ]

        for data in users_data:
            user, created = User.objects.get_or_create(
                username=data['username'],
                defaults={
                    'first_name': data['first_name'],
                    'last_name': data['last_name'],
                    'role': data['role'],
                }
            )
            if created:
                user.set_password('admin123')
                user.save()
                self.stdout.write(self.style.SUCCESS(
                    f"Created user: {data['first_name']} {data['last_name']} ({data['role']})"
                ))
            else:
                self.stdout.write(f"User already exists: {data['username']}")

        self.stdout.write(self.style.SUCCESS('Done!'))
