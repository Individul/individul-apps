import json
import os
import logging

from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from tasks.models import Task

logger = logging.getLogger(__name__)

RAPORT_TERMEN_PATH = os.getenv(
    'RAPORT_TERMEN_PATH',
    '/app/raport-data/raport-termen.json'
)

SYNC_REQUEST_FLAG = os.path.join(os.path.dirname(RAPORT_TERMEN_PATH), '.sync-requested')


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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def raport_termen_last_sync(request):
    """Returns the modification time of the raport-termen.json file."""
    try:
        mtime = os.path.getmtime(RAPORT_TERMEN_PATH)
        from datetime import datetime, timezone
        dt = datetime.fromtimestamp(mtime, tz=timezone.utc)
        return JsonResponse({'last_sync': dt.isoformat()})
    except FileNotFoundError:
        return JsonResponse({'last_sync': None})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def raport_termen_request_sync(request):
    """Creates a flag file requesting a sync from the Mac."""
    try:
        from datetime import datetime, timezone
        with open(SYNC_REQUEST_FLAG, 'w') as f:
            f.write(datetime.now(timezone.utc).isoformat())
        logger.info('Sync requested by user')
        return JsonResponse({'status': 'requested', 'message': 'Sincronizare solicitată.'})
    except Exception as e:
        logger.error('Failed to create sync request flag: %s', e)
        return JsonResponse({'detail': 'Eroare la solicitarea sincronizării.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dosar_defect_list(request):
    """Returns list of person names from active tasks (TODO/IN_PROGRESS) with their category."""
    tasks = Task.objects.filter(
        status__in=[Task.Status.TODO, Task.Status.IN_PROGRESS]
    ).values_list('title', 'status', 'category')

    result = []
    for title, status, category in tasks:
        # title format: "Nume Prenume" - normalize for matching
        parts = title.strip().split()
        if len(parts) >= 2:
            nume = parts[0]
            prenume = parts[1]
        elif len(parts) == 1:
            nume = parts[0]
            prenume = ''
        else:
            continue

        result.append({
            'nume': nume,
            'prenume': prenume,
            'status': status,
            'category': category,
        })

    return JsonResponse(result, safe=False)
