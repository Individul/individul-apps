import logging
from datetime import timedelta
from html import escape

import requests
from django.conf import settings
from django.core.mail import EmailMessage
from django.core.mail.backends.smtp import EmailBackend
from django.utils import timezone

from .models import MonitorEmailConfig
from .monitor_sync import _get_monitor_token

logger = logging.getLogger(__name__)


def fetch_upcoming_hearings():
    """
    Fetch upcoming hearings from Monitor Sedinte and filter for today and tomorrow.

    Returns:
        tuple: (sedinte_azi, sedinte_maine) -- each a list of hearing dicts.
    """
    sedinte_azi = []
    sedinte_maine = []

    try:
        token = _get_monitor_token()
        url = f"{settings.MONITOR_SEDINTE_URL}/api/sedinte/viitoare"
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        resp.raise_for_status()
        hearings = resp.json()

        today = timezone.localdate()
        tomorrow = today + timedelta(days=1)

        today_str = today.isoformat()
        tomorrow_str = tomorrow.isoformat()

        for h in hearings:
            data_iso = h.get("data_sedinta_iso", "")
            if data_iso == today_str:
                sedinte_azi.append(h)
            elif data_iso == tomorrow_str:
                sedinte_maine.append(h)

    except Exception as e:
        logger.error("Monitor email: eroare la fetch sedinte viitoare: %s", e)

    return sedinte_azi, sedinte_maine


def build_email_html(sedinte_azi, sedinte_maine):
    """
    Build an HTML email body with hearing tables for today and tomorrow.

    Args:
        sedinte_azi: list of hearing dicts for today
        sedinte_maine: list of hearing dicts for tomorrow

    Returns:
        str: HTML content for the email
    """
    today = timezone.localdate()
    tomorrow = today + timedelta(days=1)

    today_fmt = today.strftime("%d.%m.%Y")
    tomorrow_fmt = tomorrow.strftime("%d.%m.%Y")

    def _build_table(sedinte):
        if not sedinte:
            return (
                '<p style="color: #666; font-style: italic; padding: 12px 0;">'
                "Nu sunt sedinte programate"
                "</p>"
            )

        rows = ""
        for s in sedinte:
            ora = escape(str(s.get("ora", "") or ""))
            instanta = escape(str(s.get("instanta_nume", "") or ""))
            parti = escape(str(s.get("persoana_nume", "") or ""))
            judecator = escape(str(s.get("judecator", "") or ""))
            obiect_cauza = escape(str(s.get("obiect_cauza", "") or ""))

            rows += (
                "<tr>"
                f'<td style="padding: 8px 12px; border: 1px solid #ddd;">{ora}</td>'
                f'<td style="padding: 8px 12px; border: 1px solid #ddd;">{instanta}</td>'
                f'<td style="padding: 8px 12px; border: 1px solid #ddd;">{parti}</td>'
                f'<td style="padding: 8px 12px; border: 1px solid #ddd;">{judecator}</td>'
                f'<td style="padding: 8px 12px; border: 1px solid #ddd;">{obiect_cauza}</td>'
                "</tr>"
            )

        return (
            '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">'
            "<thead>"
            "<tr>"
            '<th style="padding: 10px 12px; border: 1px solid #ddd; background-color: #f5f5f5; '
            'text-align: left; font-weight: 600; color: #333;">Ora</th>'
            '<th style="padding: 10px 12px; border: 1px solid #ddd; background-color: #f5f5f5; '
            'text-align: left; font-weight: 600; color: #333;">Instanta</th>'
            '<th style="padding: 10px 12px; border: 1px solid #ddd; background-color: #f5f5f5; '
            'text-align: left; font-weight: 600; color: #333;">Parti</th>'
            '<th style="padding: 10px 12px; border: 1px solid #ddd; background-color: #f5f5f5; '
            'text-align: left; font-weight: 600; color: #333;">Judecator</th>'
            '<th style="padding: 10px 12px; border: 1px solid #ddd; background-color: #f5f5f5; '
            'text-align: left; font-weight: 600; color: #333;">Obiect</th>'
            "</tr>"
            "</thead>"
            f"<tbody>{rows}</tbody>"
            "</table>"
        )

    table_azi = _build_table(sedinte_azi)
    table_maine = _build_table(sedinte_maine)

    html = (
        "<!DOCTYPE html>"
        '<html lang="ro">'
        "<head>"
        '<meta charset="UTF-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        "</head>"
        '<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; '
        'background-color: #f9f9f9; color: #333;">'
        '<div style="max-width: 900px; margin: 0 auto; padding: 20px;">'
        # Header
        '<div style="background-color: #1a73e8; color: #ffffff; padding: 20px 24px; '
        'border-radius: 6px 6px 0 0;">'
        '<h1 style="margin: 0; font-size: 22px; font-weight: 600;">Monitor Sedinte</h1>'
        '<p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Raport sedinte programate</p>'
        "</div>"
        # Content
        '<div style="background-color: #ffffff; padding: 24px; border: 1px solid #e0e0e0; '
        'border-top: none;">'
        # Today section
        f'<h2 style="margin: 0 0 12px; font-size: 18px; color: #1a73e8; '
        f'border-bottom: 2px solid #1a73e8; padding-bottom: 8px;">'
        f"Sedinte programate azi ({today_fmt})</h2>"
        f"{table_azi}"
        # Tomorrow section
        f'<h2 style="margin: 24px 0 12px; font-size: 18px; color: #1a73e8; '
        f'border-bottom: 2px solid #1a73e8; padding-bottom: 8px;">'
        f"Sedinte programate maine ({tomorrow_fmt})</h2>"
        f"{table_maine}"
        "</div>"
        # Footer
        '<div style="padding: 16px 24px; text-align: center; font-size: 12px; color: #999; '
        'border-top: 1px solid #e0e0e0;">'
        "Generat automat de Hub &mdash; Monitor Sedinte"
        "</div>"
        "</div>"
        "</body>"
        "</html>"
    )

    return html


def send_daily_digest():
    """
    Send the daily email digest with today's and tomorrow's hearings.

    Loads SMTP configuration from MonitorEmailConfig, fetches hearings,
    builds the HTML email and sends it. Updates config with send status.
    """
    config = MonitorEmailConfig.get_config()

    if not config.enabled or not config.email_to.strip():
        return

    try:
        sedinte_azi, sedinte_maine = fetch_upcoming_hearings()
        html_content = build_email_html(sedinte_azi, sedinte_maine)

        today_fmt = timezone.localdate().strftime("%d.%m.%Y")
        subject = f"[Monitor Sedinte] Sedinte programate \u2014 {today_fmt}"

        recipients = [addr.strip() for addr in config.email_to.split(",") if addr.strip()]

        backend = EmailBackend(
            host=config.smtp_host,
            port=config.smtp_port,
            username=config.smtp_user,
            password=config.smtp_password,
            use_tls=config.smtp_use_tls,
        )

        email = EmailMessage(subject, "", config.email_from, recipients)
        email.content_subtype = "html"
        email.body = html_content

        backend.send_messages([email])

        config.last_sent = timezone.now()
        config.last_error = ""
        config.save()

        logger.info("Monitor email: digest trimis catre %s", ", ".join(recipients))

    except Exception as e:
        logger.error("Monitor email: eroare la trimiterea digestului: %s", e)
        config.last_error = str(e)
        config.save()


def send_test_email():
    """
    Send a test email to verify SMTP configuration.

    Uses the same SMTP settings from MonitorEmailConfig but sends
    a simple test message instead of the full digest.
    """
    config = MonitorEmailConfig.get_config()

    if not config.smtp_host or not config.email_to.strip() or not config.email_from:
        raise ValueError('Completati campurile SMTP Host, Email From si Email To')

    subject = "[Monitor Sedinte] Email de test"

    html_content = (
        "<!DOCTYPE html>"
        '<html lang="ro">'
        "<head>"
        '<meta charset="UTF-8">'
        "</head>"
        '<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; '
        'background-color: #f9f9f9; color: #333;">'
        '<div style="max-width: 600px; margin: 0 auto; padding: 20px;">'
        '<div style="background-color: #1a73e8; color: #ffffff; padding: 20px 24px; '
        'border-radius: 6px 6px 0 0;">'
        '<h1 style="margin: 0; font-size: 22px; font-weight: 600;">Monitor Sedinte</h1>'
        "</div>"
        '<div style="background-color: #ffffff; padding: 24px; border: 1px solid #e0e0e0; '
        'border-top: none; text-align: center;">'
        '<div style="padding: 30px 0;">'
        '<p style="font-size: 18px; color: #2e7d32; font-weight: 600; margin: 0 0 8px;">'
        "&#10004; Configurarea email functioneaza corect!"
        "</p>"
        '<p style="font-size: 14px; color: #666; margin: 0;">'
        "Acest mesaj confirma ca setarile SMTP sunt corecte."
        "</p>"
        "</div>"
        "</div>"
        '<div style="padding: 16px 24px; text-align: center; font-size: 12px; color: #999; '
        'border-top: 1px solid #e0e0e0;">'
        "Generat automat de Hub &mdash; Monitor Sedinte"
        "</div>"
        "</div>"
        "</body>"
        "</html>"
    )

    recipients = [addr.strip() for addr in config.email_to.split(",") if addr.strip()]

    backend = EmailBackend(
        host=config.smtp_host,
        port=config.smtp_port,
        username=config.smtp_user,
        password=config.smtp_password,
        use_tls=config.smtp_use_tls,
    )

    email = EmailMessage(subject, "", config.email_from, recipients)
    email.content_subtype = "html"
    email.body = html_content

    backend.send_messages([email])

    logger.info("Monitor email: test trimis catre %s", ", ".join(recipients))
