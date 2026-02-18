import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_monitor_token():
    """Login la Monitor Sedinte si obtine token."""
    url = f"{settings.MONITOR_SEDINTE_URL}/api/auth/login"
    resp = requests.post(url, json={"password": settings.MONITOR_SEDINTE_PASSWORD}, timeout=5)
    resp.raise_for_status()
    return resp.json()["token"]


def add_person_to_monitor(name):
    """Adauga persoana in Monitor Sedinte ca persoana monitorizata."""
    try:
        token = _get_monitor_token()
        url = f"{settings.MONITOR_SEDINTE_URL}/api/persoane"
        resp = requests.post(
            url,
            json={"nume": name, "tip_dosar": "Penal"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
        logger.info("Monitor: persoana '%s' adaugata (id=%s)", name, resp.json().get("id"))
        return resp.json()
    except Exception as e:
        logger.error("Monitor: eroare la adaugarea '%s': %s", name, e)
        return None


def deactivate_person_in_monitor(name):
    """Dezactiveaza persoana din Monitor Sedinte (cautare dupa nume)."""
    try:
        token = _get_monitor_token()
        headers = {"Authorization": f"Bearer {token}"}

        # Gasim persoana activa dupa nume
        url = f"{settings.MONITOR_SEDINTE_URL}/api/persoane?activ=1"
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()

        persons = resp.json()
        match = next(
            (p for p in persons if p["nume"].strip().lower() == name.strip().lower()),
            None,
        )

        if match:
            del_url = f"{settings.MONITOR_SEDINTE_URL}/api/persoane/{match['id']}"
            del_resp = requests.delete(del_url, headers=headers, timeout=10)
            del_resp.raise_for_status()
            logger.info("Monitor: persoana '%s' dezactivata (id=%s)", name, match["id"])
            return True

        logger.warning("Monitor: persoana '%s' nu a fost gasita pentru dezactivare", name)
        return False
    except Exception as e:
        logger.error("Monitor: eroare la dezactivarea '%s': %s", name, e)
        return False
