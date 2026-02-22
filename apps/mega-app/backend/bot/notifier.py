import logging
from datetime import timedelta
from telegram import Bot
from django.conf import settings
from django.utils import timezone

from sentences.models import Fraction
from petitions.models import Petition
from .models import BotNotificationLog

logger = logging.getLogger(__name__)


def _was_already_sent(notification_type: str, entity_id) -> bool:
    """Check if this notification was already sent today."""
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return BotNotificationLog.objects.filter(
        notification_type=notification_type,
        entity_id=entity_id,
        sent_at__gte=today_start
    ).exists()


def _log_sent(notification_type: str, entity_id, message_preview: str):
    """Log a sent notification."""
    BotNotificationLog.objects.create(
        notification_type=notification_type,
        entity_id=entity_id,
        message_preview=message_preview[:200]
    )


async def check_and_send_alerts():
    """Check for new alerts and send Telegram notifications."""
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID

    if not token or not chat_id:
        logger.warning('[TELEGRAM] Bot token sau chat ID neconfigurat, skip notificări')
        return 0

    bot = Bot(token=token)
    sent_count = 0
    today = timezone.now().date()

    # 1. Overdue fractions
    overdue_fractions = Fraction.objects.select_related(
        'sentence__person'
    ).filter(
        sentence__status='active',
        is_fulfilled=False,
        calculated_date__lt=today
    ).order_by('calculated_date')

    new_overdue = []
    for f in overdue_fractions:
        if not _was_already_sent(
            BotNotificationLog.NotificationType.FRACTION_OVERDUE, f.id
        ):
            new_overdue.append(f)

    if new_overdue:
        if len(new_overdue) <= 3:
            for f in new_overdue:
                days_ago = abs(f.days_until)
                text = (
                    f"🔴 <b>Fracție depășită</b>\n\n"
                    f"👤 {f.sentence.person.full_name}\n"
                    f"📅 {f.fraction_type} — {f.calculated_date.strftime('%d.%m.%Y')}\n"
                    f"⏰ Depășire: {days_ago} zile"
                )
                try:
                    await bot.send_message(chat_id, text, parse_mode='HTML')
                    _log_sent(
                        BotNotificationLog.NotificationType.FRACTION_OVERDUE,
                        f.id, f"{f.sentence.person.full_name} {f.fraction_type}"
                    )
                    sent_count += 1
                except Exception as e:
                    logger.error('[TELEGRAM] Eroare trimitere: %s', e)
        else:
            text = f"🔴 <b>{len(new_overdue)} fracții depășite noi</b>\n\n"
            for i, f in enumerate(new_overdue[:15]):
                days_ago = abs(f.days_until)
                text += (
                    f"{i+1}. {f.sentence.person.full_name} — "
                    f"{f.fraction_type} ({days_ago} zile)\n"
                )
            try:
                await bot.send_message(chat_id, text, parse_mode='HTML')
                for f in new_overdue:
                    _log_sent(
                        BotNotificationLog.NotificationType.FRACTION_OVERDUE,
                        f.id, f"{f.sentence.person.full_name} {f.fraction_type}"
                    )
                sent_count += 1
            except Exception as e:
                logger.error('[TELEGRAM] Eroare trimitere sumar: %s', e)

    # 2. Imminent fractions (next 7 days)
    imminent_fractions = Fraction.objects.select_related(
        'sentence__person'
    ).filter(
        sentence__status='active',
        is_fulfilled=False,
        calculated_date__gte=today,
        calculated_date__lte=today + timedelta(days=7)
    ).order_by('calculated_date')

    new_imminent = []
    for f in imminent_fractions:
        if not _was_already_sent(
            BotNotificationLog.NotificationType.FRACTION_IMMINENT, f.id
        ):
            new_imminent.append(f)

    if new_imminent:
        if len(new_imminent) <= 3:
            for f in new_imminent:
                text = (
                    f"🟠 <b>Fracție iminentă</b>\n\n"
                    f"👤 {f.sentence.person.full_name}\n"
                    f"📅 {f.fraction_type} — {f.calculated_date.strftime('%d.%m.%Y')}\n"
                    f"⏰ În {f.days_until} zile"
                )
                try:
                    await bot.send_message(chat_id, text, parse_mode='HTML')
                    _log_sent(
                        BotNotificationLog.NotificationType.FRACTION_IMMINENT,
                        f.id, f"{f.sentence.person.full_name} {f.fraction_type}"
                    )
                    sent_count += 1
                except Exception as e:
                    logger.error('[TELEGRAM] Eroare trimitere: %s', e)
        else:
            text = f"🟠 <b>{len(new_imminent)} fracții iminente</b>\n\n"
            for i, f in enumerate(new_imminent[:15]):
                text += (
                    f"{i+1}. {f.sentence.person.full_name} — "
                    f"{f.fraction_type} pe {f.calculated_date.strftime('%d.%m.%Y')} "
                    f"(în {f.days_until} zile)\n"
                )
            try:
                await bot.send_message(chat_id, text, parse_mode='HTML')
                for f in new_imminent:
                    _log_sent(
                        BotNotificationLog.NotificationType.FRACTION_IMMINENT,
                        f.id, f"{f.sentence.person.full_name} {f.fraction_type}"
                    )
                sent_count += 1
            except Exception as e:
                logger.error('[TELEGRAM] Eroare trimitere sumar: %s', e)

    # 3. Overdue petitions
    overdue_petitions = Petition.objects.exclude(
        status=Petition.Status.SOLUTIONATA
    ).order_by('registration_date')

    new_petition_alerts = []
    for p in overdue_petitions:
        if p.is_overdue:
            ntype = BotNotificationLog.NotificationType.PETITION_OVERDUE
        elif p.is_due_soon:
            ntype = BotNotificationLog.NotificationType.PETITION_DUE_SOON
        else:
            continue

        if not _was_already_sent(ntype, p.id):
            new_petition_alerts.append((p, ntype))

    if new_petition_alerts:
        if len(new_petition_alerts) <= 3:
            for p, ntype in new_petition_alerts:
                icon = '🔴' if ntype == BotNotificationLog.NotificationType.PETITION_OVERDUE else '🟠'
                label = 'depășită' if 'overdue' in ntype else 'scadentă în curând'
                text = (
                    f"{icon} <b>Petiție {label}</b>\n\n"
                    f"📋 {p.registration_number}\n"
                    f"⚖️ {p.get_object_type_display()}\n"
                    f"👤 {p.detainee_fullname or p.petitioner_name}\n"
                    f"📅 Termen: {p.response_due_date.strftime('%d.%m.%Y')}"
                )
                try:
                    await bot.send_message(chat_id, text, parse_mode='HTML')
                    _log_sent(ntype, p.id, f"{p.registration_number} {label}")
                    sent_count += 1
                except Exception as e:
                    logger.error('[TELEGRAM] Eroare trimitere: %s', e)
        else:
            text = f"📋 <b>{len(new_petition_alerts)} petiții urgente</b>\n\n"
            for i, (p, ntype) in enumerate(new_petition_alerts[:15]):
                icon = '🔴' if 'overdue' in ntype else '🟠'
                text += (
                    f"{icon} {p.registration_number} — "
                    f"{p.get_object_type_display()} — "
                    f"{p.detainee_fullname or p.petitioner_name}\n"
                )
            try:
                await bot.send_message(chat_id, text, parse_mode='HTML')
                for p, ntype in new_petition_alerts:
                    _log_sent(ntype, p.id, f"{p.registration_number}")
                sent_count += 1
            except Exception as e:
                logger.error('[TELEGRAM] Eroare trimitere sumar: %s', e)

    logger.info('[TELEGRAM] Trimise %d notificări', sent_count)
    return sent_count
