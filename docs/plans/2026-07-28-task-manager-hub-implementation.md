# Task Manager — Hub + navigație — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `/` devine un hub-dashboard cu două carduri (Sarcini, Petiții) cu cifre live, iar toate paginile autentificate primesc un antet comun cu tab-uri permanente Sarcini | Petiții. Lista de sarcini se mută la `/sarcini`.

**Architecture:** Un route group `(app)` cu layout comun ține antetul unic (tab-uri + clopoțel + acțiuni de cont), eliminând duplicarea din paginile actuale. Hub-ul e Server Component care calculează cifrele printr-un helper pur testat. Mutarea rutei e mecanică: redenumire + actualizarea căilor `revalidatePath` și a linkurilor.

**Tech Stack:** Next.js 14 App Router (route groups, `usePathname`), TypeScript, Tailwind + shadcn/ui, Vitest.

**Referință design:** `docs/plans/2026-07-28-task-manager-hub-design.md`

---

## Convenții & verificare

- App în `apps/task-manager/`. `npm test` = Vitest (`src/**/*.test.ts`), acum **36 teste**.
- Verificare per task: `npm run build` verde + `npm test` verde.
- Ecranele sunt după login → verificarea vizuală o face utilizatorul după deploy.
- Fără migrări, fără schimbări de RLS/logică de business. Commit după fiecare task.

---

## Task 1: Helper de statistici pentru hub (TDD)

**Files:**
- Create: `apps/task-manager/src/lib/hub-stats.ts`
- Create: `apps/task-manager/src/lib/hub-stats.test.ts`

Tipuri relevante (`src/lib/types.ts`): `Task { status: "todo"|"in_progress"|"done"; due_date: string|null }`,
`Petition { status: "in_examinare"|"solutionat"; response_deadline: string|null }`.

**Step 1: Write the failing test** — `src/lib/hub-stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { taskStats, petitionStats } from "./hub-stats";
import type { Task, Petition } from "./types";

const t = (over: Partial<Task>): Task => ({
  id: "1", title: "x", description: null, status: "todo", priority: "medium",
  due_date: null, assignee_id: null, created_by: "u", created_at: "", updated_at: "", ...over,
});

const p = (over: Partial<Petition>): Petition => ({
  id: "1", number: "1", petitioner: "x", petitioner_type: "detinut", subject: null,
  received_date: "2026-07-01", response_deadline: null, status: "in_examinare",
  response: null, response_date: null, assignee_id: null, created_by: "u",
  created_at: "", updated_at: "", ...over,
});

// "azi" fix pentru teste deterministe
const today = new Date(2026, 6, 28); // 28 iul 2026

describe("taskStats", () => {
  it("numără total și active (nefinalizate)", () => {
    const s = taskStats([t({}), t({ status: "in_progress" }), t({ status: "done" })], today);
    expect(s.total).toBe(3);
    expect(s.active).toBe(2);
  });
  it("numără restante (termen trecut, nefinalizate)", () => {
    const s = taskStats([
      t({ due_date: "2026-07-20" }),
      t({ due_date: "2026-07-20", status: "done" }),
      t({ due_date: "2026-08-10" }),
    ], today);
    expect(s.overdue).toBe(1);
  });
  it("numără scadente în 7 zile (azi inclusiv, fără restante)", () => {
    const s = taskStats([
      t({ due_date: "2026-07-28" }),
      t({ due_date: "2026-08-04" }),
      t({ due_date: "2026-08-05" }),
      t({ due_date: "2026-07-20" }),
    ], today);
    expect(s.dueSoon).toBe(2);
  });
  it("listă goală", () => {
    expect(taskStats([], today)).toEqual({ total: 0, active: 0, dueSoon: 0, overdue: 0 });
  });
});

describe("petitionStats", () => {
  it("numără total și în examinare", () => {
    const s = petitionStats([p({}), p({ status: "solutionat" })], today);
    expect(s.total).toBe(2);
    expect(s.open).toBe(1);
  });
  it("numără restante și scadente în 7 zile (doar cele în examinare)", () => {
    const s = petitionStats([
      p({ response_deadline: "2026-07-20" }),
      p({ response_deadline: "2026-07-20", status: "solutionat" }),
      p({ response_deadline: "2026-07-30" }),
      p({ response_deadline: "2026-09-01" }),
    ], today);
    expect(s.overdue).toBe(1);
    expect(s.dueSoon).toBe(1);
  });
  it("listă goală", () => {
    expect(petitionStats([], today)).toEqual({ total: 0, open: 0, dueSoon: 0, overdue: 0 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- hub-stats`
Expected: FAIL — modulul nu există.

**Step 3: Write minimal implementation** — `src/lib/hub-stats.ts`:

```ts
import { parseISO } from "date-fns";
import type { Task, Petition } from "./types";

export interface ModuleStats {
  total: number;
  dueSoon: number;
  overdue: number;
}
export interface TaskStats extends ModuleStats { active: number }
export interface PetitionStats extends ModuleStats { open: number }

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Clasifică un termen față de „azi": restant, scadent în ≤7 zile, sau nici una. */
function classify(deadline: string | null, today: Date): "overdue" | "soon" | "none" {
  if (!deadline) return "none";
  const start = startOfDay(today);
  const due = startOfDay(parseISO(deadline));
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 7) return "soon";
  return "none";
}

export function taskStats(tasks: Task[], today: Date = new Date()): TaskStats {
  let active = 0, dueSoon = 0, overdue = 0;
  for (const t of tasks) {
    if (t.status === "done") continue;
    active++;
    const c = classify(t.due_date, today);
    if (c === "overdue") overdue++;
    else if (c === "soon") dueSoon++;
  }
  return { total: tasks.length, active, dueSoon, overdue };
}

export function petitionStats(petitions: Petition[], today: Date = new Date()): PetitionStats {
  let open = 0, dueSoon = 0, overdue = 0;
  for (const p of petitions) {
    if (p.status !== "in_examinare") continue;
    open++;
    const c = classify(p.response_deadline, today);
    if (c === "overdue") overdue++;
    else if (c === "soon") dueSoon++;
  }
  return { total: petitions.length, open, dueSoon, overdue };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- hub-stats` → PASS. Apoi `npm test` (toate, ≥36) → verde.

**Step 5: Commit**

```bash
git add src/lib/hub-stats.ts src/lib/hub-stats.test.ts
git commit -m "feat(task-manager): hub stats helpers with tests"
```

---

## Task 2: Antet comun (shell) cu tab-uri de module

**Files:**
- Create: `apps/task-manager/src/components/layout/module-tabs.tsx`
- Create: `apps/task-manager/src/components/layout/app-header.tsx`

Context: antetul actual (din `src/app/page.tsx`) conține: `NotificationBell` (dacă e user),
link „Administrare" (doar admin), `ProfileDialog`, `ChangePasswordDialog`, form POST `/auth/signout`.
`petitii/page.tsx` are aceleași, minus clopoțel. Citește ambele înainte.

**Step 1:** `module-tabs.tsx` (`"use client"`) — tab-uri cu evidențierea rutei active:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MODULES = [
  { href: "/sarcini", label: "Sarcini" },
  { href: "/petitii", label: "Petiții" },
] as const;

export function ModuleTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {MODULES.map((m) => {
        const active = pathname === m.href || pathname.startsWith(`${m.href}/`);
        return (
          <Link
            key={m.href}
            href={m.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
```
Notă: detaliul sarcinii e la `/tasks/[id]`, deci nu se potrivește cu `/sarcini`. Adaugă în
`MODULES` o proprietate `match` opțională sau tratează special: consideră „Sarcini" activ și
când `pathname.startsWith("/tasks")`. Implementează curat (ex. `matchPrefixes: ["/sarcini", "/tasks"]`).

**Step 2:** `app-header.tsx` — Server Component care primește datele deja încărcate:

```tsx
import Link from "next/link";
import { ModuleTabs } from "@/components/layout/module-tabs";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ProfileDialog } from "@/components/account/profile-dialog";
import { ChangePasswordDialog } from "@/components/account/change-password-dialog";
import { Button } from "@/components/ui/button";
import type { Notification, Profile } from "@/lib/types";

interface AppHeaderProps {
  profile: Profile | null;
  notifications: Notification[];
  unread: number;
}

export function AppHeader({ profile, notifications, unread }: AppHeaderProps) {
  const isAdmin = profile?.role === "admin";
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 p-4 xl:px-10">
        <Link href="/" className="text-sm font-medium">
          Acasă
        </Link>
        <ModuleTabs />
        <div className="ml-auto flex items-center gap-2">
          {profile && (
            <NotificationBell
              initialItems={notifications}
              initialUnread={unread}
              userId={profile.id}
            />
          )}
          {isAdmin && (
            <Link href="/admin">
              <Button variant="outline" size="sm">Administrare</Button>
            </Link>
          )}
          <ProfileDialog
            currentFullName={profile?.full_name ?? ""}
            currentUsername={profile?.username ?? ""}
          />
          <ChangePasswordDialog />
          <form action="/auth/signout" method="post">
            <Button variant="outline" size="sm" type="submit">Deconectare</Button>
          </form>
        </div>
      </div>
    </header>
  );
}
```

**Step 3:** `npm run build` → verde (componentele încă nefolosite, dar trebuie să compileze).

**Step 4: Commit** `feat(task-manager): shared app header with module tabs`

---

## Task 3: Mută lista de sarcini la `/sarcini` + montează antetul

**Files:**
- Create: `apps/task-manager/src/app/sarcini/page.tsx` (conținutul vechiului `src/app/page.tsx`)
- Modify: `apps/task-manager/src/app/petitii/page.tsx`
- Modify: `apps/task-manager/src/app/tasks/page.tsx`

**Step 1:** Creează `src/app/sarcini/page.tsx` pornind de la actualul `src/app/page.tsx`:
- păstrează `export const dynamic = "force-dynamic"` și încărcarea datelor;
- **scoate** blocul de antet (titlu + butoane) și în locul lui randează `<AppHeader … />`
  deasupra conținutului. Structura:
  ```tsx
  return (
    <>
      <AppHeader profile={currentProfile} notifications={notifications} unread={unread} />
      <main className="mx-auto max-w-[1800px] p-4 xl:px-10">
        <h1 className="mb-4 text-2xl font-semibold">Sarcini</h1>
        <TasksWorkspace … />
      </main>
    </>
  );
  ```
- păstrează `getNotifications()` / `getUnreadCount()` în `Promise.all` (le folosește antetul).

**Step 2:** `petitii/page.tsx` — aceeași structură: scoate antetul propriu (Profil/Parolă/
Deconectare) și link-ul ad-hoc „← Sarcini"; randează `<AppHeader …>`. Adaugă în `Promise.all`
`getNotifications()` și `getUnreadCount()` (ca antetul să aibă clopoțel și aici).

**Step 3:** `tasks/page.tsx` — schimbă `redirect("/")` în `redirect("/sarcini")`.

**Step 4:** `npm run build` → verde. (Vechiul `src/app/page.tsx` devine hub în Task 4; până
atunci poate rămâne temporar cum e — dar dacă build-ul se plânge de duplicare, treci direct la Task 4.)

**Step 5: Commit** `refactor(task-manager): move task list to /sarcini, use shared header`

---

## Task 4: Hub-ul la `/`

**Files:**
- Modify (rescrie): `apps/task-manager/src/app/page.tsx`
- Create: `apps/task-manager/src/components/hub/module-card.tsx`

**Step 1:** `module-card.tsx` — card clickabil cu statistici:

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ModuleCardStat {
  label: string;
  value: number;
  tone?: "default" | "danger" | "warning";
}

export function ModuleCard({
  href, title, description, stats,
}: {
  href: string;
  title: string;
  description: string;
  stats: ModuleCardStat[];
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border bg-card p-6 transition-colors hover:border-foreground/20 hover:bg-muted/40"
    >
      <h2 className="text-xl font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div
              className={cn(
                "text-2xl font-medium",
                s.tone === "danger" && s.value > 0 && "text-red-600",
                s.tone === "warning" && s.value > 0 && "text-amber-600",
              )}
            >
              {s.value}
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </Link>
  );
}
```

**Step 2:** Rescrie `src/app/page.tsx` ca hub:

```tsx
import { getTasks, getPetitions, getCurrentProfile, getNotifications, getUnreadCount } from "@/lib/queries";
import { taskStats, petitionStats } from "@/lib/hub-stats";
import { AppHeader } from "@/components/layout/app-header";
import { ModuleCard } from "@/components/hub/module-card";

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const [tasks, petitions, profile, notifications, unread] = await Promise.all([
    getTasks(), getPetitions(), getCurrentProfile(), getNotifications(), getUnreadCount(),
  ]);
  const ts = taskStats(tasks);
  const ps = petitionStats(petitions);

  return (
    <>
      <AppHeader profile={profile} notifications={notifications} unread={unread} />
      <main className="mx-auto max-w-5xl p-4 xl:px-10">
        <h1 className="mb-6 text-2xl font-semibold">
          {profile?.full_name ? `Bun venit, ${profile.full_name}` : "Acasă"}
        </h1>
        <div className="grid gap-4 md:grid-cols-2">
          <ModuleCard
            href="/sarcini"
            title="Sarcini"
            description="Evidența sarcinilor echipei, cu termene și responsabili."
            stats={[
              { label: "Total", value: ts.total },
              { label: "Active", value: ts.active },
              { label: "Scadente 7 zile", value: ts.dueSoon, tone: "warning" },
              { label: "Restante", value: ts.overdue, tone: "danger" },
            ]}
          />
          <ModuleCard
            href="/petitii"
            title="Petiții"
            description="Registrul petițiilor, cu termene de răspuns."
            stats={[
              { label: "Total", value: ps.total },
              { label: "În examinare", value: ps.open },
              { label: "Scadente 7 zile", value: ps.dueSoon, tone: "warning" },
              { label: "Restante", value: ps.overdue, tone: "danger" },
            ]}
          />
        </div>
      </main>
    </>
  );
}
```

**Step 3:** `npm run build` + `npm test` → verzi.

**Step 4: Commit** `feat(task-manager): hub dashboard at / with module cards`

---

## Task 5: Actualizează căile de revalidare și linkurile

**Files:**
- Modify: `apps/task-manager/src/app/tasks/actions.ts` (9 apeluri)
- Modify: `apps/task-manager/src/app/notifications/actions.ts` (2)
- Modify: `apps/task-manager/src/app/account/actions.ts` (1)
- Modify: `apps/task-manager/src/app/admin/actions.ts` (3)
- Modify: `apps/task-manager/src/app/tasks/[id]/page.tsx` (link înapoi)
- Modify: `apps/task-manager/src/app/admin/page.tsx` (link înapoi)

**Step 1:** În fiecare `revalidatePath("/")` care se referă la **lista de sarcini** (toate cele din
`tasks/actions.ts`), înlocuiește cu `revalidatePath("/sarcini")` și adaugă `revalidatePath("/")`
acolo unde cifrele hub-ului se schimbă (creare/ștergere/finalizare/editare de sarcini). Concret,
pentru acțiunile de sarcini folosește ambele:
```ts
revalidatePath("/sarcini");
revalidatePath("/");
```
Pentru `notifications/actions.ts` păstrează `revalidatePath("/")` **și** adaugă `/sarcini`
(clopoțelul apare în antet pe ambele). Pentru `account/actions.ts` și `admin/actions.ts`,
păstrează `/` și adaugă `/sarcini` unde e relevant (numele afișat apare în listă).

**Step 2:** `tasks/[id]/page.tsx` — linkul „înapoi" `href="/"` → `href="/sarcini"` (verifică
textul butonului: „Înapoi la sarcini").

**Step 3:** `admin/page.tsx` — linkul „înapoi" `href="/"` → `href="/sarcini"`.
Lasă `redirect("/")` pentru non-admini (îi duce la hub) — corect.

**Step 4:** Verifică să nu mai rămână referințe greșite:
```bash
grep -rn 'href="/"' src --include=*.tsx
```
Doar antetul („Acasă") ar trebui să lege la `/`.

**Step 5:** `npm run build` + `npm test` → verzi.

**Step 6: Commit** `refactor(task-manager): update revalidate paths and links for /sarcini`

---

## Task 6: Verificare finală + documentație

**Files:**
- Modify: `apps/task-manager/README.md`

**Step 1:** `npm test` (≥36 verzi) + `npm run build` (rute: `/`, `/sarcini`, `/petitii`,
`/tasks/[id]`, `/admin`, …).
**Step 2:** În README, secțiune scurtă „Navigare": `/` = hub cu carduri (Sarcini, Petiții),
antet comun cu tab-uri, `/sarcini` = lista de sarcini.
**Step 3: Commit** `docs(task-manager): document hub navigation`

---

## Ordine & dependențe

```
1 (helper TDD) → 2 (antet) → 3 (mutare /sarcini) → 4 (hub) → 5 (căi) → 6 (docs)
```
Task 2 e prerechizit pentru 3 și 4. Task 5 după ce `/sarcini` există.

## Definition of Done

- [ ] `npm test` verde; `npm run build` fără erori.
- [ ] `/` = hub cu două carduri și cifre corecte; `/sarcini` = lista; `/petitii` neschimbat funcțional.
- [ ] Antet comun pe toate paginile, cu tab-uri care evidențiază modulul activ (inclusiv `/tasks/[id]` → Sarcini).
- [ ] Clopoțelul apare și pe Petiții.
- [ ] `/tasks` redirecționează la `/sarcini`; niciun link nu mai duce la lista veche de la `/`.
- [ ] Zero migrări / zero schimbări de RLS.
