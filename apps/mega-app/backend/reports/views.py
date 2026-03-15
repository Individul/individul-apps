import json
import os
import logging

from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

logger = logging.getLogger(__name__)

RAPORT_TERMEN_PATH = os.getenv(
    'RAPORT_TERMEN_PATH',
    '/app/raport-data/raport-termen.json'
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def raport_termen(request):
    try:
        with open(RAPORT_TERMEN_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return JsonResponse(data, safe=False)
    except FileNotFoundError:
        logger.error('Raport termen file not found: %s', RAPORT_TERMEN_PATH)
        return JsonResponse(
            {'detail': 'Datele nu sunt disponibile momentan.'},
            status=404
        )
    except json.JSONDecodeError:
        logger.error('Invalid JSON in raport termen file: %s', RAPORT_TERMEN_PATH)
        return JsonResponse(
            {'detail': 'Eroare la citirea datelor.'},
            status=500
        )
