# Task Manager

Task manager de echipă (4-5 persoane), **100% Vercel-native**: Next.js + Supabase,
fără backend separat. Găzduire GitHub + Vercel.

## Funcționalități

- Listă/tabel de task-uri cu sortare și filtrare (după stare, prioritate, responsabil)
- Atribuire către membrii echipei
- Termene (due date) și prioritate (scăzută/medie/ridicată)
- Statusuri: De făcut / În lucru / Finalizat
- Etichete colorate (create doar de admin; utilizatorii le pot alege)
- Comentarii pe fiecare task (editare/ștergere doar de autor)
- Notificări în aplicație (clopoțel) cu actualizare în timp real
- Autentificare cu **email sau username + parolă**, **invite-only** (utilizatori adăugați manual în Supabase)
- Fiecare utilizator își poate seta numele afișat și username-ul („Profilul meu") și schimba parola din aplicație

## Navigare

Pagina de start (`/`) e un **hub**, cu câte un card pentru fiecare modul —
**Sarcini** și **Petiții** — și cifre live: total, active (respectiv în
examinare), scadente în 7 zile și restante. După autentificare aterizezi tot
pe `/`.

Toate paginile autentificate au un **antet comun**: link „Acasă", tab-urile
**Sarcini | Petiții**, clopoțelul de notificări și acțiunile de cont („Profilul
meu", „Schimbă parola", „Deconectare"; adminii au în plus „Administrare"). Tabul
**Sarcini** rămâne activ și pe detaliul unei sarcini (`/tasks/[id]`). Detaliul
sarcinii și pagina de administrare au, sub antet, și un buton „Înapoi la
sarcini" (→ `/sarcini`).

| Rută          | Conținut                                 |
| ------------- | ---------------------------------------- |
| `/`           | hub — carduri de modul cu cifre live     |
| `/sarcini`    | lista de sarcini                         |
| `/petitii`    | registrul petițiilor                     |
| `/tasks/[id]` | detaliul unei sarcini                    |
| `/admin`      | administrare (doar admin)                |

`/tasks` redirecționează la `/sarcini`, pentru linkuri și bookmark-uri vechi.

## Stack

- **Next.js 14.1** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui** (Radix)
- **TanStack Table** (tabelul principal)
- **Supabase** — Postgres + Auth, via `@supabase/ssr`
- **react-hook-form** + **zod** (formulare)
- **Vitest** (unit) + **Playwright** (E2E)

Autorizarea e impusă de baza de date prin Row-Level Security (RLS). Mutațiile se
fac prin Server Actions; citirile prin Server Components.

## Roluri

Există două roluri: **membru** (`member`) și **administrator** (`admin`).
Autorizarea e impusă de RLS + trigger-e în Postgres (vezi
[`supabase/migrations/0002_roles.sql`](supabase/migrations/0002_roles.sql)).

| Acțiune                        | Membru                          | Administrator            |
| ------------------------------ | ------------------------------- | ------------------------ |
| Creare task                    | doar pentru sine (auto-atribuit)| pentru oricine           |
| Reatribuire task (assignee)    | nu                              | da                       |
| Editare task                   | task-uri proprii                | orice task               |
| Ștergere task                  | doar task-uri proprii           | orice task               |
| Editare comentariu             | doar autorul                    | doar autorul             |
| Ștergere comentariu            | doar autorul                    | autorul **sau** admin    |
| Gestionare roluri (`/admin`)   | nu                              | da                       |

Administratorii au acces la pagina **[`/admin`](src/app/admin/page.tsx)** unde pot
promova/retrograda utilizatori între `member` și `admin` (nu-și pot schimba
propriul rol, ca să nu se retrogradeze accidental).

> Migrarea `supabase/migrations/0002_roles.sql` trebuie aplicată (după
> `0001_init.sql`) și primul admin setat manual — vezi
> [`supabase/README.md`](supabase/README.md#2b-roluri) pentru bootstrap.

> Pentru login cu username, aplică și `supabase/migrations/0003_username.sql`
> (după `0002_roles.sql`) — vezi [`supabase/README.md`](supabase/README.md#2c-username).

## Notificări

Fiecare utilizator are un **clopoțel** (dreapta-sus, în antetul comun) cu
notificările proprii și un contor de necitite. Deschis, afișează ultimele
notificări; la click pe una o marchează citită și navighează la task, iar
„Marchează toate citite" le marchează pe toate deodată.

Notificările se generează automat la:

- **atribuire** — un task ți-a fost atribuit;
- **comentariu** — comentariu nou pe un task;
- **stare** — s-a schimbat statusul unui task;
- **editare** — un task a fost modificat;
- **ștergere** — un task a fost șters.

Destinatari: **responsabilul** (assignee) și **creatorul** task-ului, mai puțin
autorul acțiunii (nu ești notificat pentru propriile acțiuni). La atribuire e
notificat doar noul responsabil.

Livrarea e **în timp real** prin Supabase Realtime (canal `postgres_changes` pe
tabelul `notifications`, filtrat pe `user_id`), deci clopoțelul se actualizează
fără reîncărcarea paginii.

> Migrarea [`supabase/migrations/0008_notifications.sql`](supabase/migrations/0008_notifications.sql)
> trebuie aplicată (după `0007_audit.sql`); ea adaugă și tabelul `notifications`
> la publicația `supabase_realtime`.

## Dezvoltare locală

1. Instalează dependențele:
   ```bash
   cd apps/task-manager && npm install
   ```
2. Copiază `.env.example` → `.env.local` și completează:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
   (din Supabase → Project Settings → API)
3. Pornește dev server-ul:
   ```bash
   npm run dev
   ```
   → http://localhost:3006
4. Teste:
   ```bash
   npm test          # unit (Vitest)
   npm run test:e2e  # E2E (vezi e2e/README.md)
   ```

## Setup Supabase

Detalii complete în [`supabase/README.md`](supabase/README.md). Pe scurt:

1. Creează un proiect pe [supabase.com](https://supabase.com).
2. În SQL Editor rulează [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. Activează providerul Email (Authentication → Providers → Email → *Enable Email
   provider* ON; logarea cu parolă e activă implicit) și lasă *Enable email signups*
   **OFF** — invite-only. Logarea userilor existenți cu parolă funcționează și cu
   signups off.
4. Adaugă cei 4-5 membri din Authentication → Users și **setează-le o parolă**
   (Add user → cu parolă + „Auto Confirm User"). Userii își pot schimba ulterior
   parola din aplicație („Schimbă parola", dreapta-sus în antetul comun).

## Deploy pe Vercel

1. Push branch-ul pe GitHub; importă repo-ul `individul-apps` în Vercel.
2. **Root Directory: `apps/task-manager`**. Framework: Next.js (detectat automat).
3. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. În Supabase → Authentication → URL Configuration adaugă domeniul Vercel la
   Redirect URLs (`https://<app>.vercel.app/auth/callback`).
5. Push pe `main` → deploy automat.

## Structură

```
apps/task-manager/
├── src/
│   ├── app/
│   │   ├── login/           # pagină login (email + parolă)
│   │   ├── account/         # schimbare parolă (Server Action)
│   │   ├── auth/            # callback + signout (Route Handlers)
│   │   ├── sarcini/         # lista de sarcini
│   │   ├── petitii/         # registrul petițiilor + actions.ts
│   │   ├── tasks/           # [id] detaliu, actions.ts; /tasks → redirect /sarcini
│   │   ├── admin/           # administrare (doar admin)
│   │   ├── layout.tsx
│   │   └── page.tsx         # hub (carduri de modul cu cifre live)
│   ├── components/
│   │   ├── ui/             # componente shadcn/ui
│   │   ├── layout/         # antetul comun + tab-urile de modul
│   │   ├── hub/            # cardul de modul de pe pagina de start
│   │   ├── petitions/      # listă + formular petiții
│   │   └── tasks/          # tabel, formular, detaliu, etichete, comentarii
│   ├── lib/
│   │   ├── supabase/       # clienți server/browser + middleware
│   │   ├── queries.ts      # citiri Supabase
│   │   ├── schemas.ts      # zod
│   │   ├── types.ts
│   │   ├── task-filters.ts # helper-e filtrare/sortare (testate)
│   │   ├── hub-stats.ts    # cifrele de pe hub (testate)
│   │   └── permissions.ts  # helper permisiuni (testat)
│   └── middleware.ts       # refresh sesiune + protecție rute
├── supabase/
│   ├── migrations/0001_init.sql
│   └── README.md
└── e2e/                    # teste Playwright
```
