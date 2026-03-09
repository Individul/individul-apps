from django.core.management.base import BaseCommand
from tasks.monitor_email import send_daily_digest


class Command(BaseCommand):
    help = 'Trimite emailul zilnic cu sedintele programate din Monitor Sedinte'

    def handle(self, *args, **options):
        self.stdout.write('Se trimite digestul zilnic...')
        try:
            send_daily_digest()
            self.stdout.write(self.style.SUCCESS('Digest trimis cu succes.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Eroare la trimitere: {e}'))
