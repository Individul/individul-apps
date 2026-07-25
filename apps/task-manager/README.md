# Task Manager

Task manager de echipă (4-5 persoane), **100% Vercel-native**: Next.js + Supabase,
fără backend separat. Găzduire GitHub + Vercel.

## Funcționalități

- Listă/tabel de task-uri cu sortare și filtrare (după stare, prioritate, responsabil)
- Atribuire către membrii echipei
- Termene (due date) și prioritate (scăzută/medie/ridicată)
- Statusuri: De făcut / În lucru / Finalizat
- Etichete colorate
- Comentarii pe fiecare task (editare/ștergere doar de autor)
- Autentificare magic-link (passwordless), **invite-only**

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
3. Dezactivează înregistrarea publică (Authentication → Providers → Email →
   *Enable email signups* OFF) pentru a fi invite-only.
4. Adaugă cei 4-5 membri din Authentication → Users.
5. Authentication → URL Configuration → Redirect URLs: adaugă
   `http://localhost:3006/auth/callback` și (după deploy) `https://<app>.vercel.app/auth/callback`.

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
│   │   ├── login/           # pagină login (magic link)
│   │   ├── auth/            # callback + signout (Route Handlers)
│   │   ├── tasks/          # listă, [id] detaliu, actions.ts (Server Actions)
│   │   ├── layout.tsx
│   │   └── page.tsx        # redirect → /tasks
│   ├── components/
│   │   ├── ui/             # componente shadcn/ui
│   │   └── tasks/          # tabel, formular, detaliu, etichete, comentarii
│   ├── lib/
│   │   ├── supabase/       # clienți server/browser + middleware
│   │   ├── queries.ts      # citiri Supabase
│   │   ├── schemas.ts      # zod
│   │   ├── types.ts
│   │   ├── task-filters.ts # helper-e filtrare/sortare (testate)
│   │   └── permissions.ts  # helper permisiuni (testat)
│   └── middleware.ts       # refresh sesiune + protecție rute
├── supabase/
│   ├── migrations/0001_init.sql
│   └── README.md
└── e2e/                    # teste Playwright
```
