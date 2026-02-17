#!/bin/sh
# Fix ownership of mounted volumes (may be owned by root)
chown -R appuser:appuser /app/media /app/staticfiles /app/logs 2>/dev/null || true

# Switch to appuser and run the application
exec su -s /bin/sh appuser -c "python manage.py migrate --noinput && python manage.py collectstatic --noinput && python manage.py seed_users && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2"
