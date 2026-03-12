from rest_framework.routers import DefaultRouter
from .views import IndicatieViewSet, SablonViewSet

router = DefaultRouter()
router.register(r'sabloane', SablonViewSet, basename='sablon')
router.register(r'', IndicatieViewSet, basename='indicatie')

urlpatterns = router.urls
