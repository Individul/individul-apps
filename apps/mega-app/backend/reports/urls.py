from django.urls import path
from . import views

urlpatterns = [
    path('raport-termen/', views.raport_termen, name='raport-termen'),
]
