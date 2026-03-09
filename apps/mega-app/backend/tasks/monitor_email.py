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
    Fetch upcoming hearings from Monitor Sedinte and group by day for the next 7 days.

    Returns:
        dict: {date_obj: [hearing_dicts]} for each day that has hearings.
    """
    from collections import OrderedDict

    sedinte_per_zi = OrderedDict()

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
        end_date = today + timedelta(days=7)

        # Initialize all 7 days
        for i in range(7):
            day = today + timedelta(days=i)
            sedinte_per_zi[day] = []

        for h in hearings:
            data_iso = h.get("data_sedinta_iso", "")
            if not data_iso:
                continue
            from datetime import date
            try:
                h_date = date.fromisoformat(data_iso)
            except ValueError:
                continue
            if today <= h_date < end_date:
                sedinte_per_zi[h_date].append(h)

    except Exception as e:
        logger.error("Monitor email: eroare la fetch sedinte viitoare: %s", e)

    return sedinte_per_zi


def build_email_html(sedinte_per_zi):
    """
    Build an HTML email body with hearing tables for each day in the next 7 days.

    Args:
        sedinte_per_zi: OrderedDict {date: [hearing_dicts]}

    Returns:
        str: HTML content for the email
    """
    ZILE = ['Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata', 'Duminica']
    today = timezone.localdate()

    def _day_label(day):
        if day == today:
            return "Azi"
        if day == today + timedelta(days=1):
            return "Maine"
        return ZILE[day.weekday()]

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
            denumire = escape(str(s.get("denumire_dosar", "") or ""))
            parti = escape(str(s.get("persoana_nume", "") or ""))
            judecator = escape(str(s.get("judecator", "") or ""))
            obiect_cauza = escape(str(s.get("obiect_cauza", "") or ""))

            rows += (
                "<tr>"
                f'<td style="padding: 8px 12px; border: 1px solid #ddd;">{ora}</td>'
                f'<td style="padding: 8px 12px; border: 1px solid #ddd;">{instanta}</td>'
                f'<td style="padding: 8px 12px; border: 1px solid #ddd;">{denumire}</td>'
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
            'text-align: left; font-weight: 600; color: #333;">Denumire dosar</th>'
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

    # Build sections for each day
    sections = ""
    first = True
    for day, sedinte in sedinte_per_zi.items():
        label = _day_label(day)
        day_fmt = day.strftime("%d.%m.%Y")
        margin = "0" if first else "24px"
        first = False
        sections += (
            f'<h2 style="margin: {margin} 0 12px; font-size: 18px; color: #1a73e8; '
            f'border-bottom: 2px solid #1a73e8; padding-bottom: 8px;">'
            f"{label} ({day_fmt})</h2>"
            f"{_build_table(sedinte)}"
        )

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
        '<div style="background-color: #1a73e8; color: #ffffff; padding: 20px 24px; '
        'border-radius: 6px 6px 0 0;">'
        '<h1 style="margin: 0; font-size: 22px; font-weight: 600;">Monitor Sedinte</h1>'
        '<p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">'
        'Raport sedinte programate (7 zile)</p>'
        "</div>"
        '<div style="background-color: #ffffff; padding: 24px; border: 1px solid #e0e0e0; '
        'border-top: none;">'
        f"{sections}"
        "</div>"
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
        sedinte_per_zi = fetch_upcoming_hearings()
        html_content = build_email_html(sedinte_per_zi)

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
