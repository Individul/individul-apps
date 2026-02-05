from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Permite acces doar administratorilor."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_admin


class IsOperator(permissions.BasePermission):
    """Permite acces operatorilor și administratorilor."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_operator


class IsOperatorOrReadOnly(permissions.BasePermission):
    """Permite editare pentru operatori, read-only pentru ceilalți."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and request.user.is_operator


class CanManageUsers(permissions.BasePermission):
    """Permite managementul utilizatorilor doar administratorilor."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.can_manage_users
