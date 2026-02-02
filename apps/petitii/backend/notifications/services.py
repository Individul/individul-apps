from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import get_user_model
from .models import Notification
from petitions.models import Petition

User = get_user_model()


def generate_due_notifications():
    """
    Generate notifications for petitions that are due soon or overdue.
    This should be called periodically (e.g., on dashboard access or via cron).
    Avoids creating duplicates.
    """
    today = timezone.now().date()
    response_days = getattr(settings, 'PETITION_RESPONSE_DAYS', 12)
    due_soon_days = getattr(settings, 'PETITION_DUE_SOON_DAYS', 3)

    # Get operators and admins who should receive notifications
    users = User.objects.filter(
        is_active=True,
        role__in=[User.Role.OPERATOR, User.Role.ADMIN]
    )

    notifications_created = 0

    # Find overdue petitions
    overdue_boundary = today - timedelta(days=response_days)
    overdue_petitions = Petition.objects.filter(
        registration_date__lte=overdue_boundary
    ).exclude(
        status=Petition.Status.SOLUTIONATA
    )

    for petition in overdue_petitions:
        for user in users:
            # Check if we already have an overdue notification for this petition/user today
            existing = Notification.objects.filter(
                user=user,
                petition=petition,
                type=Notification.NotificationType.OVERDUE,
                created_at__date=today
            ).exists()

            if not existing:
                Notification.objects.create(
                    user=user,
                    type=Notification.NotificationType.OVERDUE,
                    petition=petition,
                    message=f"Petiția {petition.registration_number} a depășit termenul de răspuns!",
                    due_date=petition.response_due_date
                )
                notifications_created += 1

    # Find petitions due soon (within 3 days but not overdue)
    due_soon_boundary = today + timedelta(days=due_soon_days)
    due_soon_petitions = Petition.objects.filter(
        registration_date__gt=overdue_boundary,
        registration_date__lte=due_soon_boundary - timedelta(days=response_days)
    ).exclude(
        status=Petition.Status.SOLUTIONATA
    )

    for petition in due_soon_petitions:
        for user in users:
            # Check if we already have a due_soon notification for this petition/user today
            existing = Notification.objects.filter(
                user=user,
                petition=petition,
                type=Notification.NotificationType.DUE_SOON,
                created_at__date=today
            ).exists()

            if not existing:
                days_left = (petition.response_due_date - today).days
                Notification.objects.create(
                    user=user,
                    type=Notification.NotificationType.DUE_SOON,
                    petition=petition,
                    message=f"Petiția {petition.registration_number} expiră în {days_left} zile.",
                    due_date=petition.response_due_date
                )
                notifications_created += 1

    return notifications_created


def notify_assignment(petition, assigned_user):
    """Create a notification when a petition is assigned to a user."""
    Notification.objects.create(
        user=assigned_user,
        type=Notification.NotificationType.ASSIGNED,
        petition=petition,
        message=f"Vi s-a atribuit petiția {petition.registration_number}.",
        due_date=petition.response_due_date
    )


def notify_status_change(petition, old_status, new_status):
    """Create notifications when petition status changes."""
    if petition.assigned_to:
        Notification.objects.create(
            user=petition.assigned_to,
            type=Notification.NotificationType.STATUS_CHANGED,
            petition=petition,
            message=f"Statusul petiției {petition.registration_number} s-a schimbat din '{old_status}' în '{new_status}'."
        )
