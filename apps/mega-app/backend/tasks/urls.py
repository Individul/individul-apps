from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    TaskViewSet, user_list, category_list, tag_list,
    monitor_email_settings, monitor_email_test, monitor_email_send_now,
)

router = DefaultRouter()
router.register(r'', TaskViewSet, basename='task')

urlpatterns = [
    path('monitor-email/settings/', monitor_email_settings, name='monitor-email-settings'),
    path('monitor-email/test/', monitor_email_test, name='monitor-email-test'),
    path('monitor-email/send-now/', monitor_email_send_now, name='monitor-email-send-now'),
    path('users/', user_list, name='task-user-list'),
    path('categories/', category_list, name='task-category-list'),
    path('tags/', tag_list, name='task-tag-list'),
] + router.urls
