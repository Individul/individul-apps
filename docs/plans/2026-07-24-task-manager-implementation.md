# Task Manager (Vercel-native) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Task manager intern pentru o echipă de 4-5 persoane, 100% Vercel-native (Next.js + Supabase), cu listă/tabel ca vizualizare principală, atribuire, termene, prioritate, statusuri, etichete și comentarii.

**Architecture:** Next.js App Router full-stack pe Vercel. Datele în Supabase (Postgres). Server Components citesc prin clientul Supabase server-side; mutațiile prin Server Actions. Autorizarea o impune baza de date prin Row-Level Security (RLS). Auth prin Supabase magic link, invite-only.

**Tech Stack:** Next.js 14.1, React 18, TypeScript, Tailwind CSS 3, shadcn/ui (Radix + cva), TanStack Table, react-hook-form + zod, sonner, date-fns, `@supabase/ssr`, Vitest, Playwright.

**Referință design:** `docs/plans/2026-07-24-task-manager-design.md`

---

## Convenții

- Toate căile sunt relative la rădăcina monorepo-ului `individul-apps/`.
- App-ul trăiește în `apps/task-manager/` (înlocuiește scheletul Django).
- Rulează comenzile `npm`/`npx` din `apps/task-manager/`.
- Comite des, câte un commit per task finalizat.
- TDD unde logica e pură (helper-e); pentru UI/Server Actions, testele sunt E2E (Playwright).

---

## Task 0: Curăță scheletul Django și pregătește folderul

**Files:**
- Delete: `apps/task-manager/backend/`, `apps/task-manager/docker-compose.yml`, `apps/task-manager/nginx-task-manager.conf`, `apps/task-manager/frontend/` (rescriem app-ul curat)
- Create: `apps/task-manager/.gitignore`

**Step 1:** Șterge backend-ul Django și configurările Docker/nginx:

```bash
cd apps/task-manager
git rm -r backend docker-compose.yml nginx-task-manager.conf frontend/.next 2>/dev/null || true
rm -rf frontend/node_modules
```

**Step 2:** Vom rescrie app-ul Next.js direct în `apps/task-manager/` (fără subfolder `frontend/`), ca Root Directory pe Vercel să fie chiar `apps/task-manager`. Mută/șterge conținutul vechi din `frontend/`:

```bash
rm -rf frontend
```

**Step 3:** Creează `.gitignore`:

```gitignore
node_modules/
.next/
.env*.local
.vercel
*.tsbuildinfo
playwright-report/
test-results/
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore(task-manager): remove Django scaffold, prep Vercel-native app"
```

---

## Task 1: Scaffold Next.js + dependențe

**Files:**
- Create: `apps/task-manager/package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.js`, `tailwind.config.ts`, `.eslintrc.json`

**Step 1:** Creează `apps/task-manager/package.json`:

```json
{
  "name": "task-manager",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3006",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slot": "^1.0.2",
    "@supabase/ssr": "^0.5.1",
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-table": "^8.20.5",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.414.0",
    "next": "14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.52.0",
    "@hookform/resolvers": "^3.6.0",
    "sonner": "^1.5.0",
    "tailwind-merge": "^2.4.0",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.1.0",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 2:** Creează `tsconfig.json` (standard Next.js App Router cu alias `@/*`):

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3:** `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

**Step 4:** `postcss.config.js`:

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

**Step 5:** `tailwind.config.ts` (preset shadcn/ui; copiază varianta din `apps/mega-app/frontend/tailwind.config.ts` ca referință de tokens/culori). Conținutul include `content: ["./src/**/*.{ts,tsx}"]` și tema shadcn cu variabile CSS.

**Step 6:** `.eslintrc.json`:

```json
{ "extends": "next/core-web-vitals" }
```

**Step 7:** Instalează și verifică:

```bash
cd apps/task-manager && npm install
```
Expected: instalare fără erori.

**Step 8: Commit**

```bash
git add -A && git commit -m "chore(task-manager): scaffold Next.js + deps"
```

---

## Task 2: Layout de bază + Tailwind globals + shadcn utils

**Files:**
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/lib/utils.ts`, `src/app/page.tsx` (placeholder), `next-env.d.ts` (auto)

**Step 1:** `src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 2:** `src/app/globals.css` — variabilele CSS shadcn (copiază din `apps/mega-app/frontend/app/globals.css`), plus `@tailwind base/components/utilities`.

**Step 3:** `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = { title: "Task Manager", description: "Task manager de echipă" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
```

**Step 4:** `src/app/page.tsx` placeholder care redirecționează spre `/tasks` (îl completăm la Task 9).

**Step 5:** Rulează `npm run dev`, verifică că pornește pe :3006 fără erori.

**Step 6: Commit** `chore(task-manager): base layout + tailwind + utils`

---

## Task 3: Schema Supabase + RLS (migrare SQL)

**Files:**
- Create: `apps/task-manager/supabase/migrations/0001_init.sql`
- Create: `apps/task-manager/supabase/README.md` (instrucțiuni aplicare)

**Step 1:** Scrie migrarea `0001_init.sql`:

```sql
-- Enums
create type task_status as enum ('todo', 'in_progress', 'done');
create type task_priority as enum ('low', 'medium', 'high');

-- profiles (oglindește auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text default 'member',
  created_at timestamptz default now()
);

-- tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  due_date date,
  assignee_id uuid references profiles(id) on delete set null,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- tags
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#64748b'
);

create table task_tags (
  task_id uuid references tasks(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

-- comments
create table comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

-- trigger updated_at pe tasks
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

-- creare automată profil la sign-up
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table tags enable row level security;
alter table task_tags enable row level security;
alter table comments enable row level security;

-- profiles: orice membru autentificat vede profilurile; fiecare își editează propriul profil
create policy "profiles readable by authenticated" on profiles
  for select using (auth.role() = 'authenticated');
create policy "update own profile" on profiles
  for update using (auth.uid() = id);

-- tasks: workspace comun — orice autentificat vede și modifică tot
create policy "tasks select authenticated" on tasks
  for select using (auth.role() = 'authenticated');
create policy "tasks insert authenticated" on tasks
  for insert with check (auth.uid() = created_by);
create policy "tasks update authenticated" on tasks
  for update using (auth.role() = 'authenticated');
create policy "tasks delete authenticated" on tasks
  for delete using (auth.role() = 'authenticated');

-- tags & task_tags: citire+scriere pentru autentificați
create policy "tags all authenticated" on tags
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "task_tags all authenticated" on task_tags
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- comments: toți autentificații citesc; scrii doar ca tine; editezi/ștergi doar comentariul tău
create policy "comments select authenticated" on comments
  for select using (auth.role() = 'authenticated');
create policy "comments insert own" on comments
  for insert with check (auth.uid() = author_id);
create policy "comments update own" on comments
  for update using (auth.uid() = author_id);
create policy "comments delete own" on comments
  for delete using (auth.uid() = author_id);
```

**Step 2:** Scrie `supabase/README.md` cu pașii: creezi proiect pe supabase.com, rulezi SQL-ul în SQL Editor, dezactivezi „Enable email signups" (Authentication → Providers → Email) ca să fie invite-only, adaugi userii din Authentication → Users.

**Step 3:** Aplică migrarea în proiectul Supabase (manual, prin SQL Editor). Verifică în Table Editor că tabelele există.

**Step 4: Commit** `feat(task-manager): supabase schema + RLS policies`

---

## Task 4: Env + clienți Supabase (`@supabase/ssr`)

**Files:**
- Create: `.env.example`, `.env.local` (local, ne-comis), `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`, `src/middleware.ts`, `src/lib/types.ts`

**Step 1:** `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
Copiază în `.env.local` și completează din dashboard-ul Supabase (Project Settings → API).

**Step 2:** `src/lib/supabase/client.ts` (browser):

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

**Step 3:** `src/lib/supabase/server.ts` (Server Components / Actions):

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch { /* invocare din Server Component - ignorat, middleware reîmprospătează */ }
        },
      },
    },
  );
}
```

**Step 4:** `src/lib/supabase/middleware.ts` + `src/middleware.ts` — reîmprospătarea sesiunii + protejarea rutelor (redirect la `/login` dacă nu e sesiune, exceptând `/login` și `/auth`). Folosește pattern-ul oficial `@supabase/ssr` `updateSession`.

**Step 5:** `src/lib/types.ts` — tipurile domeniului:

```ts
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Profile { id: string; full_name: string | null; avatar_url: string | null; role: string; }
export interface Tag { id: string; name: string; color: string; }
export interface Task {
  id: string; title: string; description: string | null;
  status: TaskStatus; priority: TaskPriority; due_date: string | null;
  assignee_id: string | null; created_by: string;
  created_at: string; updated_at: string;
  assignee?: Profile | null; tags?: Tag[];
}
export interface Comment { id: string; task_id: string; author_id: string; body: string; created_at: string; author?: Profile; }
```

**Step 6: Commit** `feat(task-manager): supabase clients + middleware + types`

---

## Task 5: Helper-e pure de filtrare/sortare (TDD)

**Files:**
- Create: `src/lib/task-filters.ts`, `src/lib/task-filters.test.ts`

**Step 1: Write the failing test** `src/lib/task-filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterTasks, sortByPriority, PRIORITY_ORDER } from "./task-filters";
import type { Task } from "./types";

const t = (over: Partial<Task>): Task => ({
  id: "1", title: "x", description: null, status: "todo", priority: "medium",
  due_date: null, assignee_id: null, created_by: "u", created_at: "", updated_at: "", ...over,
});

describe("filterTasks", () => {
  it("filtrează după status", () => {
    const tasks = [t({ id: "a", status: "todo" }), t({ id: "b", status: "done" })];
    expect(filterTasks(tasks, { status: "done" }).map(x => x.id)).toEqual(["b"]);
  });
  it("filtrează după assignee", () => {
    const tasks = [t({ id: "a", assignee_id: "u1" }), t({ id: "b", assignee_id: "u2" })];
    expect(filterTasks(tasks, { assigneeId: "u1" }).map(x => x.id)).toEqual(["a"]);
  });
  it("fără filtre întoarce tot", () => {
    const tasks = [t({ id: "a" }), t({ id: "b" })];
    expect(filterTasks(tasks, {})).toHaveLength(2);
  });
});

describe("sortByPriority", () => {
  it("high înaintea low", () => {
    const tasks = [t({ id: "a", priority: "low" }), t({ id: "b", priority: "high" })];
    expect(sortByPriority(tasks).map(x => x.id)).toEqual(["b", "a"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- task-filters`
Expected: FAIL — modulul nu există.

**Step 3: Write minimal implementation** `src/lib/task-filters.ts`:

```ts
import type { Task, TaskStatus, TaskPriority } from "./types";

export const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export interface TaskFilter { status?: TaskStatus; assigneeId?: string; priority?: TaskPriority; }

export function filterTasks(tasks: Task[], f: TaskFilter): Task[] {
  return tasks.filter(t =>
    (f.status ? t.status === f.status : true) &&
    (f.assigneeId ? t.assignee_id === f.assigneeId : true) &&
    (f.priority ? t.priority === f.priority : true));
}

export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- task-filters`
Expected: PASS (4 teste verzi).

**Step 5: Commit** `feat(task-manager): task filter/sort helpers with tests`

---

## Task 6: Helper de permisiuni comentarii (TDD)

**Files:**
- Create: `src/lib/permissions.ts`, `src/lib/permissions.test.ts`

**Step 1: Write the failing test**:

```ts
import { describe, it, expect } from "vitest";
import { canEditComment } from "./permissions";

describe("canEditComment", () => {
  it("autorul poate edita", () => expect(canEditComment("u1", { author_id: "u1" })).toBe(true));
  it("alt user nu poate", () => expect(canEditComment("u2", { author_id: "u1" })).toBe(false));
});
```

**Step 2: Run** `npm test -- permissions` → FAIL.

**Step 3: Implement** `src/lib/permissions.ts`:

```ts
export function canEditComment(userId: string, comment: { author_id: string }): boolean {
  return userId === comment.author_id;
}
```

**Step 4: Run** `npm test -- permissions` → PASS.

**Step 5: Commit** `feat(task-manager): comment permission helper with tests`

---

## Task 7: Auth — login (magic link) + callback + sign-out

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/signout/route.ts`

**Step 1:** `src/app/login/actions.ts` — Server Action `signInWithMagicLink(formData)` care apelează `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`, întoarce mesaj de succes/eroare.

**Step 2:** `src/app/login/page.tsx` — formular cu un câmp email + buton „Trimite link de acces"; afișează confirmare „Verifică emailul". Client component minimal, folosește `sonner` pentru feedback.

**Step 3:** `src/app/auth/callback/route.ts` — Route Handler care ia `code` din query, apelează `supabase.auth.exchangeCodeForSession(code)`, apoi redirect la `/tasks`.

**Step 4:** `src/app/auth/signout/route.ts` — `supabase.auth.signOut()` apoi redirect la `/login`.

**Step 5:** Verifică manual fluxul cu un user creat în Supabase: primești email, click, ajungi în app autentificat.

**Step 6: Commit** `feat(task-manager): magic-link auth (login, callback, signout)`

---

## Task 8: Componente shadcn/ui de bază

**Files:**
- Create: `src/components/ui/{button,input,textarea,label,select,dialog,badge,avatar,separator,dropdown-menu,table}.tsx`

**Step 1:** Copiază componentele shadcn standard (le poți lua din `apps/mega-app/frontend/components/ui/` unde există, sau de la ui.shadcn.com). Toate folosesc `cn` din `@/lib/utils`.

**Step 2:** Verifică build: `npm run build` (fără erori de tip).

**Step 3: Commit** `feat(task-manager): shadcn/ui base components`

---

## Task 9: Data access — interogări task-uri (Server Component)

**Files:**
- Create: `src/lib/queries.ts` (funcții server: `getTasks`, `getTask`, `getProfiles`, `getTags`)
- Modify: `src/app/page.tsx` → redirect la `/tasks`
- Create: `src/app/tasks/page.tsx`

**Step 1:** `src/lib/queries.ts` — folosește clientul server Supabase, ex.:

```ts
import { createClient } from "@/lib/supabase/server";
import type { Task } from "./types";

export async function getTasks(): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:profiles!tasks_assignee_id_fkey(*), tags(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as Task[];
}
```
Plus `getProfiles()`, `getTags()`, `getTask(id)` cu comentarii + autor.

**Step 2:** `src/app/tasks/page.tsx` — Server Component care apelează `getTasks()`, `getProfiles()`, `getTags()` și pasează datele către tabelul client (Task 10).

**Step 3:** Verifică manual că pagina se randează cu datele (adaugă temporar un task din Supabase Table Editor).

**Step 4: Commit** `feat(task-manager): task queries + tasks page shell`

---

## Task 10: Tabelul de task-uri (TanStack Table) + filtre

**Files:**
- Create: `src/components/tasks/task-table.tsx`, `src/components/tasks/columns.tsx`, `src/components/tasks/task-filters-bar.tsx`

**Step 1:** `columns.tsx` — definește coloanele TanStack: titlu (link către detaliu), status (badge colorat), prioritate (badge), asignat (avatar+nume), termen (formatat cu date-fns, roșu dacă e depășit), etichete.

**Step 2:** `task-table.tsx` — client component cu `useReactTable`, sortare pe coloane, integrare cu `filterTasks` din Task 5 pentru filtrele rapide.

**Step 3:** `task-filters-bar.tsx` — controale: „Task nou" (deschide dialogul din Task 11), filtre pentru status/prioritate/asignat + toggle „Doar ale mele" (compară cu userul curent).

**Step 4:** Verifică sortare/filtrare manual în browser.

**Step 5: Commit** `feat(task-manager): task table with sorting and filters`

---

## Task 11: Mutații task — creare & editare (Server Actions + form)

**Files:**
- Create: `src/app/tasks/actions.ts` (`createTask`, `updateTask`, `deleteTask`), `src/components/tasks/task-form-dialog.tsx`, `src/lib/schemas.ts`

**Step 1:** `src/lib/schemas.ts` — schema zod `taskSchema` (title obligatoriu, description opțional, status, priority, due_date opțional, assignee_id opțional).

**Step 2:** `src/app/tasks/actions.ts` — Server Actions care validează cu zod, iau userul curent (`supabase.auth.getUser()`), fac insert/update/delete și `revalidatePath("/tasks")`. La `createTask`, `created_by = user.id`.

**Step 3:** `task-form-dialog.tsx` — client component cu react-hook-form + `@hookform/resolvers/zod`, câmpuri pentru toate atributele; select-uri pentru status/prioritate/asignat (din profiles). Folosit atât pentru creare cât și editare.

**Step 4:** Verifică manual: creezi un task, apare în tabel; editezi; ștergi.

**Step 5: Commit** `feat(task-manager): task create/update/delete actions + form`

---

## Task 12: Detaliu task + etichete

**Files:**
- Create: `src/app/tasks/[id]/page.tsx`, `src/components/tasks/task-detail.tsx`, `src/components/tasks/tag-picker.tsx`, actions pentru tags în `src/app/tasks/actions.ts`

**Step 1:** `[id]/page.tsx` — Server Component care apelează `getTask(id)` (cu comentarii + autor) și randează `task-detail`.

**Step 2:** `task-detail.tsx` — arată/editează toate câmpurile inline; secțiune etichete cu `tag-picker` (creezi tag nou sau atașezi existent); secțiune comentarii (Task 13).

**Step 3:** Server Actions `createTag`, `attachTag`, `detachTag` cu `revalidatePath`.

**Step 4:** Verifică manual atașare/detașare etichete.

**Step 5: Commit** `feat(task-manager): task detail page + tags`

---

## Task 13: Comentarii

**Files:**
- Create: `src/components/tasks/comments.tsx`, actions `addComment`, `editComment`, `deleteComment` în `src/app/tasks/actions.ts`

**Step 1:** Server Actions pentru comentarii — `addComment` setează `author_id = user.id`; `editComment`/`deleteComment` se bazează pe RLS (doar autorul). Toate `revalidatePath` pe `/tasks/[id]`.

**Step 2:** `comments.tsx` — listă comentarii (autor, timp relativ cu date-fns), formular adăugare; butoanele editează/șterge apar doar când `canEditComment(currentUserId, comment)` (helper din Task 6).

**Step 3:** Verifică manual: adaugi comentariu ca user A; ca user B nu vezi butoanele de edit/delete pe comentariul lui A.

**Step 4: Commit** `feat(task-manager): task comments`

---

## Task 14: E2E happy-path (Playwright)

**Files:**
- Create: `playwright.config.ts`, `e2e/tasks.spec.ts`, `e2e/README.md`

**Step 1:** `playwright.config.ts` — baseURL `http://localhost:3006`, `webServer` care rulează `npm run dev`.

**Step 2:** Notă în `e2e/README.md`: pentru auth în E2E, folosește un cont de test și fie un „magic link" citit via API-ul Supabase admin, fie setează sesiunea prin cookie-uri într-un `storageState`. Documentează pașii de obținere a sesiunii de test.

**Step 3:** `e2e/tasks.spec.ts` — test happy-path (cu `storageState` autentificat): deschide `/tasks` → „Task nou" → completează titlu + asignat → salvează → verifică apariția în tabel → deschide detaliul → adaugă un comentariu → verifică apariția.

**Step 4: Run** `npm run test:e2e`
Expected: PASS.

**Step 5: Commit** `test(task-manager): e2e happy-path for task creation + comment`

---

## Task 15: Deploy pe Vercel + README

**Files:**
- Create: `apps/task-manager/README.md`
- Update: `README.md` (rădăcină) — adaugă secțiune Task Manager

**Step 1:** `apps/task-manager/README.md` — descriere, stack, pași dev local (`.env.local`, `npm install`, `npm run dev`), pași Supabase (aplicare migrare, invite users), pași deploy.

**Step 2:** Deploy Vercel (manual, în dashboard sau `vercel` CLI):
- Import repo GitHub `individul-apps`.
- **Root Directory:** `apps/task-manager`.
- Framework preset: Next.js (auto).
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- În Supabase → Authentication → URL Configuration: adaugă domeniul Vercel la „Redirect URLs" (`https://<app>.vercel.app/auth/callback`).

**Step 3:** Verifică: push pe branșă → Preview Deploy pe Vercel; login cu magic link funcționează pe domeniul Vercel.

**Step 4:** Actualizează `README.md` rădăcină cu o secțiune scurtă „Task Manager" (stack + link).

**Step 5: Commit** `docs(task-manager): README + deploy instructions`

---

## Ordinea de execuție & dependențe

```
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15
```
- Task 5 și 6 (helper-e TDD) sunt independente de UI și pot fi făcute imediat după Task 4.
- Task 8 (componente UI) e prerechizit pentru 10-13.
- Task 3 (Supabase) și Task 4 (env) trebuie făcute înainte de orice acces la date (9+).

## Definition of Done

- [ ] `npm test` verde (Vitest).
- [ ] `npm run build` fără erori.
- [ ] `npm run test:e2e` verde (happy-path).
- [ ] Deploy Vercel funcțional, login magic-link OK pe domeniul live.
- [ ] Cei 4-5 useri adăugați invite-only în Supabase.
