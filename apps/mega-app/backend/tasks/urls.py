from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, user_list, category_list, tag_list

router = DefaultRouter()
router.register(r'', TaskViewSet, basename='task')

urlpatterns = [
    path('users/', user_list, name='task-user-list'),
    path('categories/', category_list, name='task-category-list'),
    path('tags/', tag_list, name='task-tag-list'),
] + router.urls
