from .models import AuditLog


def get_client_ip(request):
    """Extract client IP from request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def log_action(request, action, entity_type, entity_id, before_data=None, after_data=None):
    """Log an action to the audit log."""
    user = request.user if request.user.is_authenticated else None

    AuditLog.objects.create(
        actor=user,
        actor_username=user.username if user else 'anonymous',
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_json=before_data,
        after_json=after_data,
        ip_address=get_client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', '')[:500]
    )
