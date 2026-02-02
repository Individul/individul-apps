# Sistem de Gestiune a Petițiilor

Aplicație web pentru gestionarea petițiilor într-o instituție publică (penitenciar).

## Caracteristici

- Evidență completă a petițiilor cu numerotare automată
- Urmărirea termenelor legale (12 zile)
- Sistem de notificări pentru termene scadente/expirate
- Audit log complet pentru trasabilitate
- Export rapoarte XLSX și PDF
- Încărcare fișiere atașate (PDF, JPG, PNG)
- Control acces bazat pe roluri (RBAC)

## Stack Tehnic

### Backend
- Django 5.0
- Django REST Framework
- PostgreSQL 16
- Autentificare Django cu RBAC

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui (design sistem instituțional)
- react-hook-form + zod

## Structură Proiect

```
petitii/
├── backend/
│   ├── config/          # Configurare Django
│   ├── petitions/       # App principal petiții
│   ├── accounts/        # Utilizatori și roluri
│   ├── audit/           # Audit logging
│   └── notifications/   # Sistem notificări
├── frontend/
│   ├── app/             # Next.js App Router
│   ├── components/      # Componente React
│   └── lib/             # Utilități
└── docker-compose.yml
```

## Instalare

### Cerințe
- Docker și Docker Compose
- Node.js 20+ (pentru dezvoltare frontend)
- Python 3.12+ (pentru dezvoltare backend)

### Deployment cu Docker

```bash
# Clonare și configurare
cd apps/petitii
cp .env.example .env
# Editează .env cu valorile corespunzătoare

# Pornire servicii
docker-compose up -d --build

# Creare superuser
docker exec -it petitii-api python manage.py createsuperuser

# Migrații (rulează automat la start)
docker exec -it petitii-api python manage.py migrate
```

### Dezvoltare Locală

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # sau venv\Scripts\activate pe Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

## Variabile de Mediu

| Variabilă | Descriere | Exemplu |
|-----------|-----------|---------|
| SECRET_KEY | Cheie secretă Django | random-string-64-chars |
| DEBUG | Mod debug | False |
| DATABASE_URL | URL conexiune PostgreSQL | postgres://user:pass@host:5432/db |
| ALLOWED_HOSTS | Hosturi permise | petitii.example.com |
| CORS_ALLOWED_ORIGINS | Origini CORS | https://petitii.example.com |

## Roluri și Permisiuni

| Rol | Permisiuni |
|-----|------------|
| Viewer | Vizualizare petiții și rapoarte |
| Operator | CRUD petiții, adăugare rezoluții, upload fișiere |
| Admin | Management utilizatori, acces complet |

## Backup și Restaurare

### Backup Bază de Date
```bash
docker exec petitii-db pg_dump -U petitii petitii > backup_$(date +%Y%m%d).sql
```

### Restaurare
```bash
docker exec -i petitii-db psql -U petitii petitii < backup_20240101.sql
```

### Backup Fișiere Media
```bash
tar -czvf media_backup_$(date +%Y%m%d).tar.gz ./media
```

## Arhitectură

### Model de Date

**Petition (Petiție)**
- Număr înregistrare: PREFIX-SEQ/AN (ex: C-123/26)
- Tip petiționar: condamnat, rudă, avocat, organ de stat, altul
- Tip obiect: art.91, art.92, amnistie, transfer, etc.
- Termen răspuns: data înregistrare + 12 zile
- Status: înregistrată, în examinare, soluționată, respinsă, redirecționată

**PetitionAttachment (Fișier Atașat)**
- Tipuri permise: PDF, JPG, PNG
- Dimensiune maximă: 20MB

**AuditLog (Jurnal Audit)**
- Înregistrează toate operațiunile
- Stochează starea înainte/după modificare
- Include IP și user agent

**Notification (Notificare)**
- Alertare termene scadente (≤3 zile)
- Alertare termene expirate

## Decizii de Design

1. **Numerotare automată**: Secvență per an, cu prefix configurabil
2. **Calcul termen**: 12 zile calendaristice de la înregistrare
3. **Audit complet**: Toate modificările sunt înregistrate cu diff JSON
4. **Fișiere atașate**: Stocate local în /media, nu se șterg automat
5. **Notificări**: Generate la accesul dashboard-ului, fără duplicare
6. **Export PDF**: Format registru oficial, stil tabelar
7. **Design UI**: Sobru, instituțional, fără animații sau gradient

## Licență

Aplicație dezvoltată pentru uz intern instituțional.
