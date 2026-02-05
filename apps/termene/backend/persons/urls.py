from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConvictedPersonViewSet

router = DefaultRouter()
router.register('', ConvictedPersonViewSet, basename='persons')

urlpatterns = [
    path('', include(router.urls)),
]
