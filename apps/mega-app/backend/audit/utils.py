from .models import AuditLog
from .middleware import get_current_request


def log_action(request, action, entity_type, entity_id, before_data=None, after_data=None):
    """Helper to create an audit log entry."""
    ip_address = None
    user_agent = ''

    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')

    AuditLog.objects.create(
        actor=request.user if request and request.user.is_authenticated else None,
        actor_username=request.user.username if request and request.user.is_authenticated else 'system',
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_json=before_data,
        after_json=after_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )
