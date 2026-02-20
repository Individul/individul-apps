from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import CustomTokenObtainPairView

urlpatterns = [
    path('secure-mgmt-panel/', admin.site.urls),
    # Auth
    path('api/v1/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/auth/', include('accounts.urls')),
    # Modules
    path('api/v1/tasks/', include('tasks.urls')),
    path('api/v1/petitions/', include('petitions.urls')),
    path('api/v1/persons/', include('persons.urls')),
    path('api/v1/sentences/', include('sentences.urls')),
    path('api/v1/alerts/', include('alerts.urls')),
    path('api/v1/transfers/', include('transfers.urls')),
    path('api/v1/commissions/', include('commissions.urls')),
    path('api/v1/tracker/', include('tracker.urls')),
    # Shared
    path('api/v1/audit/', include('audit.urls')),
    path('api/v1/notifications/', include('notifications.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
