from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PetitionViewSet, AttachmentDownloadView

router = DefaultRouter()
router.register('', PetitionViewSet, basename='petition')

urlpatterns = [
    path('attachments/<uuid:pk>/download/', AttachmentDownloadView.as_view(), name='attachment-download'),
    path('', include(router.urls)),
]
