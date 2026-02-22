import logging
from datetime import timedelta
from asgiref.sync import sync_to_async
from telegram import Bot
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


# --- Sync DB functions (called via sync_to_async) ---

def _was_already_sent(notification_type: str, entity_id) -> bool:
    """Check if this notification was already sent today."""
    from .models import BotNotificationLog

    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return BotNotificationLog.objects.filter(
        notification_type=notification_type,
        entity_id=entity_id,
        sent_at__gte=today_start
    ).exists()


def _log_sent(notification_type: str, entity_id, message_preview: str):
    """Log a sent notification."""
    from .models import BotNotificationLog

    BotNotificationLog.objects.create(
        notification_type=notification_type,
        entity_id=entity_id,
        message_preview=message_preview[:200]
    )


def _get_overdue_fractions():
    from sentences.models import Fraction
    from .models import BotNotificationLog

    today = timezone.now().date()
    fractions = list(
        Fraction.objects.select_related('sentence__person').filter(
            sentence__status='active',
            is_fulfilled=False,
            calculated_date__lt=today
        ).order_by('calculated_date')
    )
    results = []
    for f in fractions:
        if not _was_already_sent(
            BotNotificationLog.NotificationType.FRACTION_OVERDUE, f.id
        ):
            results.append({
                'id': f.id,
                'name': f.sentence.person.full_name,
                'fraction_type': f.fraction_type,
                'date': f.calculated_date.strftime('%d.%m.%Y'),
                'days': abs(f.days_until),
            })
    return results


def _get_imminent_fractions():
    from sentences.models import Fraction
    from .models import BotNotificationLog

    today = timezone.now().date()
    fractions = list(
        Fraction.objects.select_related('sentence__person').filter(
            sentence__status='active',
            is_fulfilled=False,
            calculated_date__gte=today,
            calculated_date__lte=today + timedelta(days=7)
        ).order_by('calculated_date')
    )
    results = []
    for f in fractions:
        if not _was_already_sent(
            BotNotificationLog.NotificationType.FRACTION_IMMINENT, f.id
        ):
            results.append({
                'id': f.id,
                'name': f.sentence.person.full_name,
                'fraction_type': f.fraction_type,
                'date': f.calculated_date.strftime('%d.%m.%Y'),
                'days': f.days_until,
            })
    return results


def _get_petition_alerts():
    from petitions.models import Petition
    from .models import BotNotificationLog

    petitions = Petition.objects.exclude(
        status=Petition.Status.SOLUTIONATA
    ).order_by('registration_date')

    results = []
    for p in petitions:
        if p.is_overdue:
            ntype = BotNotificationLog.NotificationType.PETITION_OVERDUE
        elif p.is_due_soon:
            ntype = BotNotificationLog.NotificationType.PETITION_DUE_SOON
        else:
            continue

        if not _was_already_sent(ntype, p.id):
            results.append({
                'id': p.id,
                'ntype': ntype,
                'reg': p.registration_number,
                'obj': p.get_object_type_display(),
                'name': p.detainee_fullname or p.petitioner_name,
                'due': p.response_due_date.strftime('%d.%m.%Y'),
            })
    return results


def _log_sent_batch(items):
    """Log multiple sent notifications. Items: list of (ntype, entity_id, preview)."""
    for ntype, entity_id, preview in items:
        _log_sent(ntype, entity_id, preview)


# --- Async send function ---

async def check_and_send_alerts():
    """Check for new alerts and send Telegram notifications."""
    from .models import BotNotificationLog

    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID

    if not token or not chat_id:
        logger.warning('[TELEGRAM] Bot token sau chat ID neconfigurat, skip notificări')
        return 0

    bot = Bot(token=token)
    sent_count = 0

    # 1. Overdue fractions
    new_overdue = await sync_to_async(_get_overdue_fractions)()

    if new_overdue:
        log_items = []
        if len(new_overdue) <= 3:
            for f in new_overdue:
                text = (
                    f"🔴 <b>Fracție depășită</b>\n\n"
                    f"👤 {f['name']}\n"
                    f"📅 {f['fraction_type']} — {f['date']}\n"
                    f"⏰ Depășire: {f['days']} zile"
                )
                try:
                    await bot.send_message(chat_id, text, parse_mode='HTML')
                    log_items.append((
                        BotNotificationLog.NotificationType.FRACTION_OVERDUE,
                        f['id'], f"{f['name']} {f['fraction_type']}"
                    ))
                    sent_count += 1
                except Exception as e:
                    logger.error('[TELEGRAM] Eroare trimitere: %s', e)
        else:
            text = f"🔴 <b>{len(new_overdue)} fracții depășite noi</b>\n\n"
            for i, f in enumerate(new_overdue[:15]):
                text += (
                    f"{i+1}. {f['name']} — "
                    f"{f['fraction_type']} ({f['days']} zile)\n"
                )
            try:
                await bot.send_message(chat_id, text, parse_mode='HTML')
                for f in new_overdue:
                    log_items.append((
                        BotNotificationLog.NotificationType.FRACTION_OVERDUE,
                        f['id'], f"{f['name']} {f['fraction_type']}"
                    ))
                sent_count += 1
            except Exception as e:
                logger.error('[TELEGRAM] Eroare trimitere sumar: %s', e)

        if log_items:
            await sync_to_async(_log_sent_batch)(log_items)

    # 2. Imminent fractions (next 7 days)
    new_imminent = await sync_to_async(_get_imminent_fractions)()

    if new_imminent:
        log_items = []
        if len(new_imminent) <= 3:
            for f in new_imminent:
                text = (
                    f"🟠 <b>Fracție iminentă</b>\n\n"
                    f"👤 {f['name']}\n"
                    f"📅 {f['fraction_type']} — {f['date']}\n"
                    f"⏰ În {f['days']} zile"
                )
                try:
                    await bot.send_message(chat_id, text, parse_mode='HTML')
                    log_items.append((
                        BotNotificationLog.NotificationType.FRACTION_IMMINENT,
                        f['id'], f"{f['name']} {f['fraction_type']}"
                    ))
                    sent_count += 1
                except Exception as e:
                    logger.error('[TELEGRAM] Eroare trimitere: %s', e)
        else:
            text = f"🟠 <b>{len(new_imminent)} fracții iminente</b>\n\n"
            for i, f in enumerate(new_imminent[:15]):
                text += (
                    f"{i+1}. {f['name']} — "
                    f"{f['fraction_type']} pe {f['date']} "
                    f"(în {f['days']} zile)\n"
                )
            try:
                await bot.send_message(chat_id, text, parse_mode='HTML')
                for f in new_imminent:
                    log_items.append((
                        BotNotificationLog.NotificationType.FRACTION_IMMINENT,
                        f['id'], f"{f['name']} {f['fraction_type']}"
                    ))
                sent_count += 1
            except Exception as e:
                logger.error('[TELEGRAM] Eroare trimitere sumar: %s', e)

        if log_items:
            await sync_to_async(_log_sent_batch)(log_items)

    # 3. Petition alerts
    new_petitions = await sync_to_async(_get_petition_alerts)()

    if new_petitions:
        log_items = []
        if len(new_petitions) <= 3:
            for p in new_petitions:
                icon = '🔴' if p['ntype'] == BotNotificationLog.NotificationType.PETITION_OVERDUE else '🟠'
                label = 'depășită' if 'overdue' in p['ntype'] else 'scadentă în curând'
                text = (
                    f"{icon} <b>Petiție {label}</b>\n\n"
                    f"📋 {p['reg']}\n"
                    f"⚖️ {p['obj']}\n"
                    f"👤 {p['name']}\n"
                    f"📅 Termen: {p['due']}"
                )
                try:
                    await bot.send_message(chat_id, text, parse_mode='HTML')
                    log_items.append((p['ntype'], p['id'], f"{p['reg']} {label}"))
                    sent_count += 1
                except Exception as e:
                    logger.error('[TELEGRAM] Eroare trimitere: %s', e)
        else:
            text = f"📋 <b>{len(new_petitions)} petiții urgente</b>\n\n"
            for i, p in enumerate(new_petitions[:15]):
                icon = '🔴' if 'overdue' in p['ntype'] else '🟠'
                text += (
                    f"{icon} {p['reg']} — {p['obj']} — {p['name']}\n"
                )
            try:
                await bot.send_message(chat_id, text, parse_mode='HTML')
                for p in new_petitions:
                    log_items.append((p['ntype'], p['id'], p['reg']))
                sent_count += 1
            except Exception as e:
                logger.error('[TELEGRAM] Eroare trimitere sumar: %s', e)

        if log_items:
            await sync_to_async(_log_sent_batch)(log_items)

    logger.info('[TELEGRAM] Trimise %d notificări', sent_count)
    return sent_count
