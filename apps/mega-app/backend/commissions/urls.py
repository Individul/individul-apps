from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CommissionSessionViewSet

router = DefaultRouter()
router.register('', CommissionSessionViewSet, basename='commission')

urlpatterns = [
    path('', include(router.urls)),
]
