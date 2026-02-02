# Individul Apps

Monorepo pentru aplicațiile web personale.

## Aplicații

### Portal
Landing page cu split layout pentru acces rapid la toate aplicațiile.

### Clasificare
Calculator Fracțiuni (React + Vite + Tailwind)

### PDF Toolbox
Instrumente PDF pentru procesarea documentelor (FastAPI + Docker)
- Comprimare PDF
- Conversie imagini în PDF
- Îmbinare PDF-uri

### Task Manager
Dashboard pentru gestionarea sarcinilor (Next.js + Django + Docker)

### Registru Petiții
Sistem complet de gestionare a petițiilor pentru instituții (Next.js + Django + PostgreSQL + Docker)

**Funcționalități:**
- Autentificare utilizatori cu roluri (viewer, operator, admin)
- Înregistrare petiții cu număr unic de înregistrare
- Clasificare pe tipuri: petiționar (condamnat, rudă, avocat, organ de stat, altul) și obiect (art. 91, art. 92, amnistie, transfer, etc.)
- Urmărire status: înregistrată, în examinare, soluționată, respinsă, redirecționată
- Calcul automat termen răspuns (12 zile lucrătoare)
- Alertă pentru petiții cu termen depășit sau scadente în curând
- Încărcare fișiere atașate (PDF, JPG, PNG)
- Export liste în format XLSX și PDF
- Jurnalizare acțiuni (audit log)
- Notificări pentru termene

**Tehnologii:**
- Frontend: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Django 5, Django REST Framework, PostgreSQL
- Autentificare: JWT (SimpleJWT)
- Containerizare: Docker, Docker Compose

### Gestionare Dosare Defecte
Sistem de evidență și urmărire a dosarelor cu defecte (în dezvoltare)

**Funcționalități planificate:**
- Înregistrare dosare cu defecte identificate
- Clasificare tipuri defecte
- Urmărire status rezolvare
- Termene pentru remediere
- Rapoarte și statistici
- Export date

## Structura proiectului

```
individul-apps/
├── apps/
│   ├── portal/          # Landing page
│   ├── clasificare/     # Calculator fracțiuni
│   ├── pdf/             # PDF Toolbox
│   ├── task-manager/    # Task Manager
│   └── petitii/         # Registru Petiții
│       ├── backend/     # Django API
│       └── frontend/    # Next.js App
├── .github/
│   └── workflows/       # GitHub Actions
└── README.md
```

## Deploy

Automat via GitHub Actions la fiecare push pe branch-ul `main`.

### Porturi aplicații:
- Portal: 80 (nginx root)
- Clasificare: /clasificare/
- PDF Toolbox: 8001 (proxy /pdf/)
- Task Manager: 3002 (proxy /tasks/), 8000 (API /tasks-api/)
- Petitii: 3003 (proxy /petitii/), 8002 (API /petitii-api/)

## Server

- **Provider:** Hetzner CX22
- **OS:** Ubuntu 22.04
- **Web Server:** Nginx (reverse proxy)
- **Containerizare:** Docker, Docker Compose
- **IP:** 46.224.209.71

## Acces aplicații

- Portal: http://46.224.209.71/
- Clasificare: http://46.224.209.71/clasificare/
- PDF Toolbox: http://46.224.209.71/pdf/
- Task Manager: http://46.224.209.71/tasks/
- Registru Petiții: http://46.224.209.71/petitii/
