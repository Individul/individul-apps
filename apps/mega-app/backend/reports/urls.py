from django.urls import path
from . import views

urlpatterns = [
    path('raport-termen/', views.raport_termen, name='raport-termen'),
    path('raport-termen/last-sync/', views.raport_termen_last_sync, name='raport-termen-last-sync'),
    path('raport-termen/request-sync/', views.raport_termen_request_sync, name='raport-termen-request-sync'),
    path('dosar-defect/', views.dosar_defect_list, name='dosar-defect'),
]
