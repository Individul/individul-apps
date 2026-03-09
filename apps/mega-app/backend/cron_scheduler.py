"""
Simple cron scheduler for running periodic management commands.
Runs inside a Docker container as a separate service.
"""
import os
import time
import subprocess
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

logging.basicConfig(level=logging.INFO, format='%(asctime)s [CRON] %(message)s')
logger = logging.getLogger(__name__)

SCHEDULE_HOUR = int(os.getenv('DIGEST_HOUR', '7'))
SCHEDULE_MINUTE = int(os.getenv('DIGEST_MINUTE', '0'))
TZ = os.getenv('TZ', 'Europe/Bucharest')

def run_digest():
    logger.info('Running send_monitor_digest...')
    result = subprocess.run(
        ['python', 'manage.py', 'send_monitor_digest'],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        logger.info('Digest completed: %s', result.stdout.strip())
    else:
        logger.error('Digest failed: %s', result.stderr.strip())

def main():
    logger.info('Cron scheduler started. Schedule: %02d:%02d (%s)', SCHEDULE_HOUR, SCHEDULE_MINUTE, TZ)
    last_run_date = None

    while True:
        tz = ZoneInfo(TZ)
        now = datetime.now(tz)
        today = now.date()

        if (now.hour == SCHEDULE_HOUR and
            now.minute == SCHEDULE_MINUTE and
            last_run_date != today):
            run_digest()
            last_run_date = today

        time.sleep(30)

if __name__ == '__main__':
    main()
