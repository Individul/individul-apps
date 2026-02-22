import logging
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Pornește botul Telegram HUB în mod polling'

    def handle(self, *args, **options):
        from bot.telegram_bot import create_bot_application

        self.stdout.write('Pornesc botul Telegram HUB...')
        logger.info('[TELEGRAM] Pornesc botul...')

        app = create_bot_application()
        app.run_polling(drop_pending_updates=True)
