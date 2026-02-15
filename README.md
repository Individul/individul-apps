# Individul Apps

Monorepo pentru aplicațiile web destinate gestionării activității penitenciare.

## Aplicații

### Portal
Landing page cu split layout pentru acces rapid la toate aplicațiile.

### Hub (Mega-App)
Sistem unificat de management penitenciar care consolidează multiple module specializate. (Next.js + Django + PostgreSQL + Docker)

**Module:**
- **Dashboard** - Panou central cu KPI-uri și statistici din toate modulele
- **Dosare Defecte** - Evidența dosarelor cu defecte (cumulare, arest preventiv, neclarități) cu priorități și termene
- **Petiții** - Registru complet de petiții cu workflow de status, clasificare pe tipuri și sectoare, atașamente
- **Termene** - Monitorizarea executării pedepselor cu calcul automat al fracțiunilor (1/3, 1/2, 2/3) și alerte
- **Transferuri** - Evidența transferurilor inter-penitenciare (18 penitenciare, statistici pe trimestre)
- **Comisia** - Evaluări în cadrul ședințelor comisiei (Art. 91, 92, 107, Grațiere)
- **Rapoarte** - Dashboard analitic și export date
- **Admin** - Administrare utilizatori și roluri

**Tehnologii:**
- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI, React Query
- Backend: Django 5, Django REST Framework, PostgreSQL 16
- Autentificare: JWT (SimpleJWT)
- Containerizare: Docker, Docker Compose

### Termene
Sistem specializat pentru monitorizarea și gestionarea termenelor de executare a pedepselor. (Next.js + Django + PostgreSQL + Docker)

**Funcționalități:**
- Registru persoane condamnate
- Evidența pedepselor cu durată (ani/luni/zile) și clasificare pe tipuri de infracțiune
- Calcul automat fracțiuni de liberare (1/3, 1/2, 2/3) cu date concrete
- Reduceri de pedeapsă pe baza articolelor de lege
- Sistem de alerte (iminente, apropiate, îndepărtate)
- Export rapoarte PDF și XLSX
- Jurnalizare completă (audit log)

**Tehnologii:**
- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI, React Query
- Backend: Django 5, Django REST Framework, PostgreSQL 16
- Autentificare: JWT (SimpleJWT)
- Containerizare: Docker, Docker Compose

### Registru Petiții
Sistem complet de gestionare a petițiilor pentru instituții. (Next.js + Django + PostgreSQL + Docker)

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

### Clasificare
Calculator fracțiuni liberare anticipată conform Art. 91 și Art. 92 CP RM. (React + Vite + Tailwind)

**Funcționalități:**
- Clasificare infracțiuni pe categorii (U, MPG, G, DG, EG) conform Art. 16 CP RM
- Calcul fracțiuni Art. 91 (liberare condiționată) diferențiate pe vârstă (minor, tânăr, adult, vârstnic)
- Calcul fracțiuni Art. 92 (înlocuirea părții neexecutate)
- Calculator termene cu dată concretă de eligibilitate
- Deducerea perioadei de arest preventiv
- Baza de date cu 400+ infracțiuni din Codul Penal

### PDF Toolbox
Instrumente PDF pentru procesarea documentelor. (FastAPI + Docker)

- Comprimare PDF
- Conversie imagini în PDF
- Îmbinare PDF-uri
- Ștergere și extragere pagini

### Task Manager
Dashboard pentru gestionarea sarcinilor. (Next.js + Django + Docker)

## Structura proiectului

```
individul-apps/
├── apps/
│   ├── portal/          # Landing page
│   ├── mega-app/        # Hub - sistem unificat de management
│   │   ├── backend/     # Django API
│   │   └── frontend/    # Next.js App
│   ├── termene/         # Termene executare pedepse
│   │   ├── backend/     # Django API
│   │   └── frontend/    # Next.js App
│   ├── petitii/         # Registru Petiții
│   │   ├── backend/     # Django API
│   │   └── frontend/    # Next.js App
│   ├── clasificare/     # Calculator fracțiuni (Vite + React)
│   ├── pdf/             # PDF Toolbox (FastAPI)
│   └── task-manager/    # Task Manager
│       ├── backend/     # Django API
│       └── frontend/    # Next.js App
├── .github/
│   └── workflows/       # GitHub Actions (deploy.yml)
└── README.md
```

## Deploy

Automat via GitHub Actions la fiecare push pe branch-ul `main`.

### Porturi și rute:

| Aplicație | Frontend | API | Ruta nginx |
|-----------|----------|-----|------------|
| Portal | 80 (nginx static) | - | `/` |
| Clasificare | nginx static | - | `/clasificare/` |
| PDF Toolbox | - | 8001 | `/pdf/` |
| Task Manager | 3002 | 8000 | `/tasks/`, `/tasks-api/` |
| Petiții | 3003 | 8002 | `/petitii/`, `/petitii-api/` |
| Termene | 3004 | 8003 | `/termene/`, `/termene-api/` |
| Hub | 3005 | 8004 | `/hub/`, `/hub-api/` |

## Server

- **Provider:** Hetzner CX22
- **OS:** Ubuntu 22.04
- **Web Server:** Nginx (reverse proxy)
- **Containerizare:** Docker, Docker Compose
- **IP:** 46.224.209.71

## Acces aplicații

- Portal: http://46.224.209.71/
- Hub: http://46.224.209.71/hub/
- Termene: http://46.224.209.71/termene/
- Petiții: http://46.224.209.71/petitii/
- Clasificare: http://46.224.209.71/clasificare/
- PDF Toolbox: http://46.224.209.71/pdf/
- Task Manager: http://46.224.209.71/tasks/
