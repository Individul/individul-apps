import asyncio
import logging
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Verifică și trimite notificări Telegram pentru alerte noi'

    def handle(self, *args, **options):
        from bot.notifier import check_and_send_alerts

        self.stdout.write('Verific alerte noi...')
        sent_count = asyncio.run(check_and_send_alerts())
        self.stdout.write(f'Trimise {sent_count} notificări.')
