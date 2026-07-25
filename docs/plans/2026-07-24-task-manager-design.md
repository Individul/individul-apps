# Task Manager (Vercel-native) — Design

**Data:** 2026-07-24
**Autor:** brainstorming cu Claude Code
**Locație în monorepo:** `apps/task-manager` (înlocuiește scheletul Django existent)

## Scop

Task manager intern pentru o echipă de 4-5 persoane. Găzduire pe **GitHub + Vercel**,
100% Vercel-native (fără backend separat). Un singur deploy, free tier.

## Decizii cheie (din brainstorming)

| Întrebare | Decizie |
|-----------|---------|
| Arhitectură | 100% Vercel-native: Next.js full-stack pe Vercel |
| Bază de date + Auth | Supabase (Postgres + Auth gata făcut) |
| Funcții MVP | Atribuire membri, termene + prioritate, statusuri, comentarii + etichete |
| Vizualizare principală | Listă / tabel sortabil & filtrabil |
| Acces la date | Supabase direct cu Row-Level Security (RLS) |

## Abordare tehnică

**Aleasă: Supabase direct cu RLS.**
Server Components citesc prin clientul Supabase; mutațiile prin Server Actions.
Autorizarea o impune baza de date prin RLS. Cel mai puțin cod, sigur din start.

Alternative respinse:
- API routes ca backend subțire cu service-role → reimplementezi autorizarea în cod, mai mult loc de greșeli.
- Drizzle/Prisma + Auth.js → contrazice alegerea Supabase Auth, piese în plus, overkill.

## Stack

- **Next.js (App Router)** + TypeScript
- **Tailwind CSS** + **shadcn/ui** (Radix dedesubt — aceeași convenție ca restul monorepo-ului)
- **TanStack Table** pentru tabelul principal (sortare/filtrare)
- **Supabase**: Postgres + Auth, prin `@supabase/ssr`
- **Vitest** (unit) + **Playwright** (E2E)

## Model de date (Postgres / Supabase)

- **profiles** — `id` (= auth user id), `full_name`, `avatar_url`, `role`
- **tasks** — `id`, `title`, `description`, `status` (`todo` | `in_progress` | `done`),
  `priority` (`low` | `medium` | `high`), `due_date`, `assignee_id` → profiles,
  `created_by` → profiles, `created_at`, `updated_at`
- **tags** — `id`, `name`, `color`
- **task_tags** — legătură many-to-many (`task_id`, `tag_id`)
- **comments** — `id`, `task_id`, `author_id` → profiles, `body`, `created_at`

## Ecrane

1. **Login** — magic link (passwordless).
2. **Listă task-uri** (ecran principal) — tabel sortabil/filtrabil (după asignat, status,
   prioritate, termen), buton „Task nou", filtre rapide (al meu / status / prioritate).
3. **Detaliu task** — panou lateral sau pagină: editare câmpuri, schimbare
   status/prioritate/asignat, etichete, fir de comentarii.
4. *(Ulterior, opțional)* comutare pe board Kanban — modelul de date deja îl suportă.

## Auth & drepturi (RLS)

- **Invite-only**: signup public dezactivat; utilizatorii sunt adăugați din dashboard-ul
  Supabase. Login prin magic link.
- Workspace comun: orice membru autentificat **vede și editează toate task-urile** și poate
  comenta (echipă mică, de încredere).
- Excepție: un comentariu poate fi editat/șters doar de autorul lui.
- Politicile RLS reflectă exact regulile de mai sus.

## Testare & deploy

- **Vitest** — logică pură (helper-e de filtrare, permisiuni).
- **Playwright** — 1-2 fluxuri E2E happy-path (login → creare task → comentariu).
- **Vercel** conectat la GitHub, *Root Directory* = `apps/task-manager`.
- Migrări SQL versionate în `apps/task-manager/supabase/migrations`.
- Push pe `main` → deploy automat pe Vercel.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (doar server).

## Note de migrare

- Scheletul Django existent din `apps/task-manager` (backend/, docker-compose, nginx) se
  elimină. Va fi înlocuit de app-ul Next.js Vercel-native.
