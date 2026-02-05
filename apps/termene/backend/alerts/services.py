from django.utils import timezone
from django.conf import settings
from django.contrib.auth import get_user_model

from .models import Alert
from sentences.models import Fraction

User = get_user_model()


def generate_alerts_for_user(user):
    """
    Generate alerts for a specific user based on fraction dates.
    This clears existing unread alerts and generates new ones.
    """
    today = timezone.now().date()
    imminent_days = getattr(settings, 'FRACTION_IMMINENT_DAYS', 30)
    upcoming_days = getattr(settings, 'FRACTION_UPCOMING_DAYS', 90)

    # Clear existing unread alerts for this user
    Alert.objects.filter(user=user, is_read=False).delete()

    # Get all active sentence fractions that are not fulfilled
    fractions = Fraction.objects.select_related(
        'sentence', 'sentence__person'
    ).filter(
        sentence__status='active',
        is_fulfilled=False
    )

    alerts_to_create = []

    for fraction in fractions:
        days_until = (fraction.calculated_date - today).days
        person = fraction.sentence.person

        if days_until < 0:
            # Overdue
            alert_type = Alert.AlertType.OVERDUE
            priority = Alert.Priority.HIGH
            message = (
                f"Termen depășit pentru {person.full_name}: "
                f"fracția {fraction.fraction_type} a fost programată pentru {fraction.calculated_date.strftime('%d.%m.%Y')} "
                f"(acum {abs(days_until)} zile)."
            )
        elif days_until <= imminent_days:
            # Imminent
            alert_type = Alert.AlertType.IMMINENT
            priority = Alert.Priority.HIGH
            message = (
                f"Termen iminent pentru {person.full_name}: "
                f"fracția {fraction.fraction_type} în {days_until} zile ({fraction.calculated_date.strftime('%d.%m.%Y')})."
            )
        elif days_until <= upcoming_days:
            # Upcoming
            alert_type = Alert.AlertType.UPCOMING
            priority = Alert.Priority.MEDIUM
            message = (
                f"Termen în curând pentru {person.full_name}: "
                f"fracția {fraction.fraction_type} în {days_until} zile ({fraction.calculated_date.strftime('%d.%m.%Y')})."
            )
        else:
            # Too far in the future, skip
            continue

        alerts_to_create.append(Alert(
            user=user,
            alert_type=alert_type,
            priority=priority,
            fraction=fraction,
            person=person,
            message=message,
            target_date=fraction.calculated_date,
        ))

    # Bulk create alerts
    Alert.objects.bulk_create(alerts_to_create)

    return len(alerts_to_create)


def generate_alerts_for_all_users():
    """
    Generate alerts for all active operators and admins.
    """
    users = User.objects.filter(
        is_active=True,
        role__in=['operator', 'admin']
    )

    total_alerts = 0
    for user in users:
        total_alerts += generate_alerts_for_user(user)

    return total_alerts


def get_dashboard_alert_summary(user):
    """
    Get a summary of alerts for the dashboard.
    """
    today = timezone.now().date()
    imminent_days = getattr(settings, 'FRACTION_IMMINENT_DAYS', 30)
    upcoming_days = getattr(settings, 'FRACTION_UPCOMING_DAYS', 90)

    # Count directly from fractions for real-time accuracy
    fractions = Fraction.objects.filter(
        sentence__status='active',
        is_fulfilled=False
    )

    overdue_count = fractions.filter(calculated_date__lt=today).count()

    imminent_count = fractions.filter(
        calculated_date__gte=today,
        calculated_date__lte=today + timezone.timedelta(days=imminent_days)
    ).count()

    upcoming_count = fractions.filter(
        calculated_date__gt=today + timezone.timedelta(days=imminent_days),
        calculated_date__lte=today + timezone.timedelta(days=upcoming_days)
    ).count()

    fulfilled_count = Fraction.objects.filter(
        sentence__status='active',
        is_fulfilled=True
    ).count()

    return {
        'overdue': overdue_count,
        'imminent': imminent_count,
        'upcoming': upcoming_count,
        'fulfilled': fulfilled_count,
        'total': overdue_count + imminent_count + upcoming_count,
    }
