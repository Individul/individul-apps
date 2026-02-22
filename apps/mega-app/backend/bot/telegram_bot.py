import logging
from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from django.conf import settings
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta

logger = logging.getLogger(__name__)

CHAT_ID = None


def is_authorized(update: Update) -> bool:
    if not CHAT_ID:
        return True
    return str(update.effective_chat.id) == str(CHAT_ID)


# --- Sync DB functions (called via sync_to_async) ---

def _get_sumar_data():
    from persons.models import ConvictedPerson
    from sentences.models import Fraction
    from petitions.models import Petition
    from tasks.models import Task

    today = timezone.now().date()

    fractions_qs = Fraction.objects.filter(
        sentence__status='active', is_fulfilled=False
    )
    overdue = fractions_qs.filter(calculated_date__lt=today).count()
    imminent = fractions_qs.filter(
        calculated_date__gte=today,
        calculated_date__lte=today + timedelta(days=30)
    ).count()
    upcoming = fractions_qs.filter(
        calculated_date__gt=today + timedelta(days=30),
        calculated_date__lte=today + timedelta(days=90)
    ).count()

    total_persons = ConvictedPerson.objects.count()
    active_persons = ConvictedPerson.objects.filter(
        sentences__status='active'
    ).distinct().count()
    released = ConvictedPerson.objects.filter(
        release_date__isnull=False
    ).count()

    total_petitions = Petition.objects.count()
    petitions_open = Petition.objects.exclude(
        status=Petition.Status.SOLUTIONATA
    ).count()

    tasks_todo = Task.objects.filter(status=Task.Status.TODO).count()
    tasks_in_progress = Task.objects.filter(status=Task.Status.IN_PROGRESS).count()

    return {
        'today': today, 'overdue': overdue, 'imminent': imminent,
        'upcoming': upcoming, 'total_persons': total_persons,
        'active_persons': active_persons, 'released': released,
        'total_petitions': total_petitions, 'petitions_open': petitions_open,
        'tasks_todo': tasks_todo, 'tasks_in_progress': tasks_in_progress,
    }


def _get_alerte_data():
    from sentences.models import Fraction

    today = timezone.now().date()

    overdue_list = list(
        Fraction.objects.select_related('sentence__person').filter(
            sentence__status='active', is_fulfilled=False,
            calculated_date__lt=today
        ).order_by('calculated_date')[:10]
    )

    imminent_list = list(
        Fraction.objects.select_related('sentence__person').filter(
            sentence__status='active', is_fulfilled=False,
            calculated_date__gte=today,
            calculated_date__lte=today + timedelta(days=7)
        ).order_by('calculated_date')[:10]
    )

    results = []
    for f in overdue_list:
        results.append({
            'type': 'overdue',
            'name': f.sentence.person.full_name,
            'fraction_type': f.fraction_type,
            'date': f.calculated_date.strftime('%d.%m.%Y'),
            'days': abs(f.days_until),
        })
    for f in imminent_list:
        results.append({
            'type': 'imminent',
            'name': f.sentence.person.full_name,
            'fraction_type': f.fraction_type,
            'date': f.calculated_date.strftime('%d.%m.%Y'),
            'days': f.days_until,
        })
    return results


def _get_petitii_data():
    from petitions.models import Petition

    open_petitions = Petition.objects.exclude(
        status=Petition.Status.SOLUTIONATA
    ).order_by('registration_date')

    overdue = []
    due_soon = []
    for p in open_petitions:
        if p.is_overdue:
            overdue.append({
                'reg': p.registration_number,
                'obj': p.get_object_type_display(),
                'name': p.detainee_fullname or p.petitioner_name,
                'due': p.response_due_date.strftime('%d.%m.%Y'),
                'days': abs(p.days_until_due),
            })
        elif p.is_due_soon:
            due_soon.append({
                'reg': p.registration_number,
                'obj': p.get_object_type_display(),
                'name': p.detainee_fullname or p.petitioner_name,
                'due': p.response_due_date.strftime('%d.%m.%Y'),
                'days': p.days_until_due,
            })
    return overdue, due_soon


def _get_taskuri_data():
    from tasks.models import Task

    active_tasks = list(
        Task.objects.filter(
            status__in=[Task.Status.TODO, Task.Status.IN_PROGRESS]
        ).select_related('assignee').order_by('-priority', '-created_at')[:15]
    )

    results = []
    for t in active_tasks:
        results.append({
            'title': t.title,
            'priority': t.priority,
            'status': 'TODO' if t.status == Task.Status.TODO else 'ÎN LUCRU',
            'assignee': t.assignee.get_full_name() if t.assignee else '—',
            'deadline': t.deadline.strftime('%d.%m.%Y') if t.deadline else None,
        })
    return results


def _get_cauta_data(query):
    from persons.models import ConvictedPerson

    persons = list(
        ConvictedPerson.objects.filter(
            Q(last_name__icontains=query) | Q(first_name__icontains=query)
        )[:10]
    )

    results = []
    for p in persons:
        nearest = p.nearest_fraction
        nearest_str = ''
        if nearest:
            nearest_str = (
                f" | Următorul termen: {nearest.fraction_type} "
                f"pe {nearest.calculated_date.strftime('%d.%m.%Y')}"
            )
        release_str = ''
        if p.release_date:
            release_str = f"\n    Eliberat: {p.release_date.strftime('%d.%m.%Y')}"

        results.append({
            'name': p.full_name,
            'active_count': p.active_sentences_count,
            'nearest_str': nearest_str,
            'release_str': release_str,
        })
    return results


def _get_status_data():
    from persons.models import ConvictedPerson
    from sentences.models import Fraction, Sentence
    from petitions.models import Petition
    from tasks.models import Task

    return {
        'total_persons': ConvictedPerson.objects.count(),
        'active_sentences': Sentence.objects.filter(status='active').count(),
        'total_fractions': Fraction.objects.filter(
            sentence__status='active', is_fulfilled=False
        ).count(),
        'total_petitions': Petition.objects.exclude(
            status=Petition.Status.SOLUTIONATA
        ).count(),
        'total_tasks': Task.objects.exclude(status=Task.Status.DONE).count(),
    }


# --- Async command handlers ---

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    await update.message.reply_text(
        "<b>HUB — Bot de notificări</b>\n\n"
        "Comenzi disponibile:\n"
        "/sumar — Dashboard KPI-uri\n"
        "/alerte — Fracții depășite și iminente\n"
        "/petitii — Petiții scadente/depășite\n"
        "/taskuri — Task-uri active\n"
        "/cauta {nume} — Caută persoană\n"
        "/status — Status sistem",
        parse_mode='HTML'
    )


async def cmd_sumar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return

    d = await sync_to_async(_get_sumar_data)()

    text = (
        f"<b>📊 Sumar HUB — {d['today'].strftime('%d.%m.%Y')}</b>\n\n"
        f"<b>👥 Persoane</b>\n"
        f"  Total: {d['total_persons']} | Active: {d['active_persons']} | Eliberate: {d['released']}\n\n"
        f"<b>⏰ Fracții</b>\n"
        f"  🔴 Depășite: {d['overdue']}\n"
        f"  🟠 Iminente (≤30 zile): {d['imminent']}\n"
        f"  🟡 În curând (30-90 zile): {d['upcoming']}\n\n"
        f"<b>📋 Petiții</b>\n"
        f"  Total: {d['total_petitions']} | Deschise: {d['petitions_open']}\n\n"
        f"<b>📝 Task-uri</b>\n"
        f"  TODO: {d['tasks_todo']} | În lucru: {d['tasks_in_progress']}"
    )
    await update.message.reply_text(text, parse_mode='HTML')


async def cmd_alerte(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return

    alerts = await sync_to_async(_get_alerte_data)()

    if not alerts:
        await update.message.reply_text('Nu sunt alerte active.')
        return

    text = '<b>🚨 Alerte fracții</b>\n\n'

    overdue = [a for a in alerts if a['type'] == 'overdue']
    imminent = [a for a in alerts if a['type'] == 'imminent']

    if overdue:
        text += '<b>🔴 Depășite:</b>\n'
        for a in overdue:
            text += (
                f"  • {a['name']} — {a['fraction_type']} "
                f"din {a['date']} ({a['days']} zile)\n"
            )
        text += '\n'

    if imminent:
        text += '<b>🟠 Iminente (7 zile):</b>\n'
        for a in imminent:
            text += (
                f"  • {a['name']} — {a['fraction_type']} "
                f"pe {a['date']} (în {a['days']} zile)\n"
            )

    await update.message.reply_text(text, parse_mode='HTML')


async def cmd_petitii(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return

    overdue, due_soon = await sync_to_async(_get_petitii_data)()

    if not overdue and not due_soon:
        await update.message.reply_text('Nu sunt petiții scadente sau depășite.')
        return

    text = '<b>📋 Petiții urgente</b>\n\n'

    if overdue:
        text += f'<b>🔴 Depășite ({len(overdue)}):</b>\n'
        for p in overdue[:10]:
            text += (
                f"  • {p['reg']} — {p['obj']} — {p['name']}\n"
                f"    Scadentă: {p['due']} ({p['days']} zile depășire)\n"
            )
        text += '\n'

    if due_soon:
        text += f'<b>🟠 Scadente în curând ({len(due_soon)}):</b>\n'
        for p in due_soon[:10]:
            text += (
                f"  • {p['reg']} — {p['obj']} — {p['name']}\n"
                f"    Scadentă: {p['due']} (în {p['days']} zile)\n"
            )

    await update.message.reply_text(text, parse_mode='HTML')


async def cmd_taskuri(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return

    tasks = await sync_to_async(_get_taskuri_data)()

    if not tasks:
        await update.message.reply_text('Nu sunt task-uri active.')
        return

    priority_icons = {'HIGH': '🔴', 'MEDIUM': '🟡', 'LOW': '🟢'}

    text = f'<b>📝 Task-uri active ({len(tasks)})</b>\n\n'
    for t in tasks:
        icon = priority_icons.get(t['priority'], '⚪')
        deadline_str = f" | Termen: {t['deadline']}" if t['deadline'] else ''
        text += (
            f"{icon} <b>[{t['status']}]</b> {t['title']}\n"
            f"    Atribuit: {t['assignee']}{deadline_str}\n"
        )

    await update.message.reply_text(text, parse_mode='HTML')


async def cmd_cauta(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return

    if not context.args:
        await update.message.reply_text('Utilizare: /cauta Nume Prenume')
        return

    query = ' '.join(context.args).strip()
    persons = await sync_to_async(_get_cauta_data)(query)

    if not persons:
        await update.message.reply_text(f'Nu s-au găsit rezultate pentru "{query}".')
        return

    text = f'<b>🔍 Rezultate pentru "{query}" ({len(persons)}):</b>\n\n'
    for p in persons:
        text += (
            f"👤 <b>{p['name']}</b>\n"
            f"    Sentințe active: {p['active_count']}{p['nearest_str']}{p['release_str']}\n\n"
        )

    await update.message.reply_text(text, parse_mode='HTML')


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return

    d = await sync_to_async(_get_status_data)()

    text = (
        '<b>⚙️ Status sistem HUB</b>\n\n'
        f"👥 Persoane în evidență: {d['total_persons']}\n"
        f"⚖️ Sentințe active: {d['active_sentences']}\n"
        f"📅 Fracții neîndeplinite: {d['total_fractions']}\n"
        f"📋 Petiții deschise: {d['total_petitions']}\n"
        f"📝 Task-uri active: {d['total_tasks']}"
    )
    await update.message.reply_text(text, parse_mode='HTML')


def create_bot_application() -> Application:
    """Create and configure the Telegram bot application."""
    global CHAT_ID

    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        raise ValueError('TELEGRAM_BOT_TOKEN nu este configurat')

    CHAT_ID = settings.TELEGRAM_CHAT_ID

    app = Application.builder().token(token).build()

    app.add_handler(CommandHandler('start', cmd_start))
    app.add_handler(CommandHandler('sumar', cmd_sumar))
    app.add_handler(CommandHandler('alerte', cmd_alerte))
    app.add_handler(CommandHandler('petitii', cmd_petitii))
    app.add_handler(CommandHandler('taskuri', cmd_taskuri))
    app.add_handler(CommandHandler('cauta', cmd_cauta))
    app.add_handler(CommandHandler('status', cmd_status))

    logger.info('[TELEGRAM] Bot configurat cu %d handlere', 7)
    return app
