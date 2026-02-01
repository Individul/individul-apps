from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, user_list

router = DefaultRouter()
router.register(r'tasks', TaskViewSet)

urlpatterns = [
    path('users/', user_list, name='user-list'),
] + router.urls
