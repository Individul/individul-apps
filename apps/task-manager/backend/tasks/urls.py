from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, user_list, category_list, tag_list

router = DefaultRouter()
router.register(r'tasks', TaskViewSet)

urlpatterns = [
    path('users/', user_list, name='user-list'),
    path('categories/', category_list, name='category-list'),
    path('tags/', tag_list, name='tag-list'),
] + router.urls
