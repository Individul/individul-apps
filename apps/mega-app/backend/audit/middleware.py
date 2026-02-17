import threading

_request_local = threading.local()


def get_current_request():
    """Get the current request from thread local storage."""
    return getattr(_request_local, 'request', None)


class AuditMiddleware:
    """Middleware to store the current request for audit logging."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _request_local.request = request
        response = self.get_response(request)
        return response
