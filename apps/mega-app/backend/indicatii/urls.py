from rest_framework.routers import DefaultRouter
from .views import IndicatieViewSet

router = DefaultRouter()
router.register(r'', IndicatieViewSet, basename='indicatie')

urlpatterns = router.urls
