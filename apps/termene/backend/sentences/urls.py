from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SentenceViewSet, FractionViewSet

router = DefaultRouter()
router.register('fractions', FractionViewSet, basename='fractions')
router.register('', SentenceViewSet, basename='sentences')

urlpatterns = [
    path('', include(router.urls)),
]
