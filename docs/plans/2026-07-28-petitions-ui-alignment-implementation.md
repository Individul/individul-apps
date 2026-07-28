# Petiții — aliniere UI/UX — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Pagina `/petitii` capătă aceeași structură ca `/sarcini`: dungă de urgență pe rând, bară de filtre, vizualizări rapide, statistici laterale, meniu de acțiuni pe rol și antet sortabil.

**Architecture:** Un `PetitionsWorkspace` (oglindă la `TasksWorkspace`) ține starea de filtrare și aranjează trei coloane. Filtrarea și permisiunile stau în helper-e pure testate. Lista existentă e refactorizată să primească filtrul din exterior și să câștige dunga de urgență + meniul „⋯".

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind + shadcn/ui, date-fns, Vitest.

**Referință design:** `docs/plans/2026-07-28-petitions-ui-alignment-design.md`

---

## Convenții & verificare

- App în `apps/task-manager/`. `npm test` = Vitest (52 teste acum). Verificare per task:
  `npm run build` + `npm test` verzi.
- Ecranul e după login → verificarea vizuală o face utilizatorul după deploy.
- Fără migrări, fără schimbări de RLS. Commit după fiecare task.
- **Citește întâi omologul de la sarcini** pentru fiecare component și oglindește-l (aceleași
  clase, aceeași densitate) — uniformitatea e scopul.

---

## Task 1: Helper-e pure — filtrare + permisiuni (TDD)

**Files:**
- Create: `apps/task-manager/src/lib/petition-filters.ts`
- Create: `apps/task-manager/src/lib/petition-filters.test.ts`
- Modify: `apps/task-manager/src/lib/permissions.ts`
- Modify: `apps/task-manager/src/lib/permissions.test.ts`

Context: `src/lib/task-filters.ts` are `TaskFilter { status?, assigneeId?, priority?, due?, tagId?, search? }`
și `filterTasks`. `src/components/petitions/meta.ts` exportă `daysUntil(deadline)` și `fold(s)`
(căutare fără diacritice). `Petition { id, number, petitioner, petitioner_type, subject, received_date,
response_deadline, status: "in_examinare"|"solutionat", assignee_id, created_by, ... }`.

**Step 1: Write the failing tests** — `src/lib/petition-filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterPetitions, type PetitionFilter } from "./petition-filters";
import type { Petition } from "./types";

const p = (over: Partial<Petition>): Petition => ({
  id: "1", number: "1/2026", petitioner: "Ion Popescu", petitioner_type: "detinut",
  subject: null, received_date: "2026-07-01", response_deadline: null,
  status: "in_examinare", response: null, response_date: null, assignee_id: null,
  created_by: "u", created_at: "", updated_at: "", ...over,
});

const today = new Date(2026, 6, 28); // 28 iul 2026

describe("filterPetitions", () => {
  it("fără filtre întoarce tot", () => {
    expect(filterPetitions([p({}), p({ id: "2" })], {}, today)).toHaveLength(2);
  });

  it("filtrează după stare", () => {
    const r = filterPetitions(
      [p({ id: "a" }), p({ id: "b", status: "solutionat" })],
      { status: "solutionat" },
      today,
    );
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });

  it("filtrează după responsabil", () => {
    const r = filterPetitions(
      [p({ id: "a", assignee_id: "u1" }), p({ id: "b", assignee_id: "u2" })],
      { assigneeId: "u1" },
      today,
    );
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("caută fără diacritice în număr, petiționar și obiect", () => {
    const items = [
      p({ id: "a", petitioner: "Crîlov Pavel" }),
      p({ id: "b", subject: "Solicitare hotărâre" }),
      p({ id: "c", number: "42/2026" }),
      p({ id: "d", petitioner: "Altcineva" }),
    ];
    expect(filterPetitions(items, { search: "crilov" }, today).map((x) => x.id)).toEqual(["a"]);
    expect(filterPetitions(items, { search: "hotarare" }, today).map((x) => x.id)).toEqual(["b"]);
    expect(filterPetitions(items, { search: "42" }, today).map((x) => x.id)).toEqual(["c"]);
  });

  it("filtrează restantele (termen trecut, în examinare)", () => {
    const items = [
      p({ id: "a", response_deadline: "2026-07-20" }),
      p({ id: "b", response_deadline: "2026-07-20", status: "solutionat" }),
      p({ id: "c", response_deadline: "2026-08-20" }),
    ];
    expect(filterPetitions(items, { due: "overdue" }, today).map((x) => x.id)).toEqual(["a"]);
  });

  it("filtrează scadentele în 5 zile (fără restante)", () => {
    const items = [
      p({ id: "a", response_deadline: "2026-07-30" }),
      p({ id: "b", response_deadline: "2026-08-20" }),
      p({ id: "c", response_deadline: "2026-07-20" }),
    ];
    expect(filterPetitions(items, { due: "soon" }, today).map((x) => x.id)).toEqual(["a"]);
  });

  it("combină filtrele (AND)", () => {
    const items = [
      p({ id: "a", assignee_id: "u1", status: "in_examinare" }),
      p({ id: "b", assignee_id: "u1", status: "solutionat" }),
      p({ id: "c", assignee_id: "u2", status: "in_examinare" }),
    ];
    const f: PetitionFilter = { assigneeId: "u1", status: "in_examinare" };
    expect(filterPetitions(items, f, today).map((x) => x.id)).toEqual(["a"]);
  });
});
```

Și adaugă în `src/lib/permissions.test.ts` (merge importurile în linia existentă, nu dubla):

```ts
describe("canEditPetition / canDeletePetition", () => {
  const pet = { created_by: "owner", assignee_id: null as string | null };

  it("adminul poate edita și șterge orice", () => {
    expect(canEditPetition("x", true, pet)).toBe(true);
    expect(canDeletePetition("x", true, pet)).toBe(true);
  });
  it("creatorul poate edita și șterge", () => {
    expect(canEditPetition("owner", false, pet)).toBe(true);
    expect(canDeletePetition("owner", false, pet)).toBe(true);
  });
  it("responsabilul poate edita, dar nu șterge", () => {
    const assigned = { created_by: "owner", assignee_id: "a" };
    expect(canEditPetition("a", false, assigned)).toBe(true);
    expect(canDeletePetition("a", false, assigned)).toBe(false);
  });
  it("un străin nu poate nimic", () => {
    expect(canEditPetition("x", false, pet)).toBe(false);
    expect(canDeletePetition("x", false, pet)).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- petition-filters permissions`
Expected: FAIL — modul/funcții inexistente.

**Step 3: Write minimal implementation**

`src/lib/petition-filters.ts`:
```ts
import { fold } from "@/components/petitions/meta";
import type { Petition, PetitionStatus } from "./types";

export type PetitionDueFilter = "overdue" | "soon";

export interface PetitionFilter {
  status?: PetitionStatus;
  assigneeId?: string;
  due?: PetitionDueFilter;
  search?: string;
}

/** Zile până la termen față de „azi” (negativ = restant). */
function daysUntil(deadline: string | null, today: Date): number | null {
  if (!deadline) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = deadline.split("-").map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function isPetitionOverdueOn(p: Petition, today: Date): boolean {
  const d = daysUntil(p.response_deadline, today);
  return p.status === "in_examinare" && d !== null && d < 0;
}

export function isPetitionDueSoonOn(p: Petition, today: Date, within = 5): boolean {
  const d = daysUntil(p.response_deadline, today);
  return p.status === "in_examinare" && d !== null && d >= 0 && d <= within;
}

export function filterPetitions(
  petitions: Petition[],
  f: PetitionFilter,
  today: Date = new Date(),
): Petition[] {
  const q = f.search ? fold(f.search.trim()) : "";
  return petitions.filter((p) => {
    if (f.status && p.status !== f.status) return false;
    if (f.assigneeId && p.assignee_id !== f.assigneeId) return false;
    if (f.due === "overdue" && !isPetitionOverdueOn(p, today)) return false;
    if (f.due === "soon" && !isPetitionDueSoonOn(p, today)) return false;
    if (q) {
      const hay = `${fold(p.number)} ${fold(p.petitioner)} ${fold(p.subject ?? "")}`;
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
```
Notă: dacă importul din `@/components/...` într-un fișier din `lib/` pare invers, mută `fold`
în `src/lib/text.ts` și importă-l din ambele locuri — alege varianta curată și actualizează
`meta.ts` să reexporte, ca să nu spargi nimic.

În `src/lib/permissions.ts` adaugă:
```ts
export function canEditPetition(
  userId: string,
  isAdmin: boolean,
  petition: { created_by: string; assignee_id: string | null },
): boolean {
  return isAdmin || userId === petition.created_by || userId === petition.assignee_id;
}

export function canDeletePetition(
  userId: string,
  isAdmin: boolean,
  petition: { created_by: string },
): boolean {
  return isAdmin || userId === petition.created_by;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test` → toate verzi (52 + ~11).

**Step 5: Commit**

```bash
git add src/lib/petition-filters.ts src/lib/petition-filters.test.ts src/lib/permissions.ts src/lib/permissions.test.ts
git commit -m "feat(task-manager): petition filter and permission helpers with tests"
```

---

## Task 2: Workspace + bară de filtre

**Files:**
- Create: `apps/task-manager/src/components/petitions/petitions-workspace.tsx`
- Create: `apps/task-manager/src/components/petitions/petition-filters-bar.tsx`
- Modify: `apps/task-manager/src/components/petitions/petitions-list.tsx`
- Modify: `apps/task-manager/src/app/petitii/page.tsx`

**Step 1:** CITEȘTE `src/components/tasks/tasks-workspace.tsx` și `task-filters-bar.tsx` — le oglindim.

**Step 2:** `petitions-workspace.tsx` (`"use client"`), oglindă la `TasksWorkspace`:
```tsx
const [filter, setFilter] = useState<PetitionFilter>({});
```
Layout: `flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8`, cu
`<aside className="lg:w-56 lg:shrink-0">` (vizualizări rapide — Task 3),
`<div className="min-w-0 flex-1">` (bara de filtre + lista),
`<aside className="space-y-4 lg:w-80 lg:shrink-0">` (statistici — Task 3).
În acest task, sidebar-urile pot rămâne goale/placeholder; important e scheletul + filtrul.
Props: `{ petitions, profiles, currentUserId, isAdmin }`.

**Step 3:** `petition-filters-bar.tsx` (`"use client"`), oglindă la `TaskFiltersBar`:
- căutare (mută inputul existent din `petitions-list.tsx`, cu aceeași iconiță și placeholder),
- Select **Stare** (`STATUS_OPTIONS` din `meta.ts`, plus „Toate stările" prin sentinela `"all"`),
- Select **Responsabil** („Toți responsabilii" + fiecare profil),
- Buton toggle **„Doar ale mele"** (activ când `filter.assigneeId === currentUserId`),
- Buton **„Petiție nouă"** cu `ml-auto` (primește `onNewPetition`).
Aceleași clase/dimensiuni ca la sarcini.

**Step 4:** `petitions-list.tsx` — refactor: primește `filter: PetitionFilter` prin props
(în loc de state-ul intern de căutare), aplică `filterPetitions(petitions, filter)` și păstrează
sortarea actuală (nesoluționate primele, apoi după termen). Scoate inputul de căutare și butonul
„Petiție nouă" (au trecut în bara de filtre); primește `onNewPetition`/`onEdit` de sus sau
păstrează dialogul intern — alege varianta cu cel mai puțin zgomot, dar păstrează comportamentul.

**Step 5:** `app/petitii/page.tsx` — randează `<PetitionsWorkspace …>` în loc de `<PetitionsList …>`.
Antetul comun (`AppHeader`) și `<h1>Petiții</h1>` rămân.

**Step 6:** `npm run build` + `npm test` → verzi.

**Step 7: Commit** `feat(task-manager): petitions workspace with filters bar`

---

## Task 3: Vizualizări rapide + statistici

**Files:**
- Create: `apps/task-manager/src/components/petitions/petition-quick-views.tsx`
- Create: `apps/task-manager/src/components/petitions/petition-summary.tsx`
- Create: `apps/task-manager/src/components/petitions/petition-assignee-breakdown.tsx`
- Modify: `apps/task-manager/src/components/petitions/petitions-workspace.tsx`

**Step 1:** CITEȘTE `tasks/quick-views.tsx`, `tasks/task-summary.tsx`, `tasks/assignee-breakdown.tsx`.

**Step 2:** `petition-quick-views.tsx` — aceeași structură ca `QuickViews`, cu vederile:
| Etichetă | Filtru |
|---|---|
| Toate | `{}` |
| Ale mele | `{ assigneeId: currentUserId }` |
| Restante | `{ due: "overdue" }` |
| Scadente 5 zile | `{ due: "soon" }` |
| În examinare | `{ status: "in_examinare" }` |
| Soluționate | `{ status: "solutionat" }` |
Contorul fiecărei vederi = `filterPetitions(petitions, view.filter).length`. Punctul colorat:
neutru / accent / roșu / ambră / ambră / verde (consistent cu `STATUS_DOT` și cu urgențele).

**Step 3:** `petition-summary.tsx` — card „Rezumat" ca `TaskSummary`: Total, În examinare,
Soluționate, Restante + bară de progres (soluționate / total).

**Step 4:** `petition-assignee-breakdown.tsx` — card „Pe responsabil". Refolosește
`countsByAssignee` + `isPetitionOverdue` din `@/lib/hub-stats` (deja există și e testat):
rânduri cu avatar (`avatarColor`) + nume + număr, cu restanțele în roșu când > 0.

**Step 5:** Montează-le în `petitions-workspace.tsx` în cele două `aside`-uri.

**Step 6:** `npm run build` + `npm test` → verzi.

**Step 7: Commit** `feat(task-manager): petitions quick views and stats sidebars`

---

## Task 4: Dungă de urgență + meniu acțiuni + antet sortabil

**Files:**
- Modify: `apps/task-manager/src/components/petitions/petitions-list.tsx`

**Step 1:** CITEȘTE `src/components/tasks/task-table.tsx` (rândurile cu `items-stretch`, dunga
`w-1 shrink-0`, meniul `TaskActionsMenu`, `HeaderSortButton`) — oglindim exact.

**Step 2: Dunga de urgență.** Rândul devine
`<div className="flex items-stretch …">` cu primul copil:
```tsx
const URGENCY_BAR = {
  overdue: "bg-red-500",
  soon: "bg-amber-500",
  open: "bg-slate-300",
  solved: "bg-green-500",
} as const;
```
Calculează starea din `daysUntil(p.response_deadline)` + `p.status` (soluționat → `solved`;
restant → `overdue`; ≤5 zile → `soon`; altfel `open`). Pune `aria-label`/`title` cu explicația
(ex. „Restant", „Scadent în 3 zile", „În examinare", „Soluționat"). Restul conținutului rândului
intră într-un `<div className="flex flex-1 items-center gap-3 px-3.5 py-2 min-w-0">`.

**Step 3: Meniu acțiuni.** Ultima coloană (`w-8 shrink-0 flex justify-end`), cu
`onClick={(e) => e.stopPropagation()}` pe container (clicul pe rând deschide editarea).
Un `DropdownMenu` cu trigger ghost-icon `MoreHorizontal` și items:
- **Editează** (`Pencil`) — dacă `canEditPetition(currentUserId ?? "", isAdmin, p)`;
- **Șterge** (`Trash2`, `text-destructive`) — dacă `canDeletePetition(currentUserId ?? "", isAdmin, p)`,
  cu `window.confirm("Ștergi această petiție?")`, apoi `deletePetition(p.id)` în `useTransition`,
  cu `toast.error` / `toast.success("Petiție ștearsă")` (importă din `@/app/petitii/actions`).
Dacă niciuna nu e permisă, randează `—` muted (ca la sarcini).

**Step 4: Antet sortabil.** Un buton mic de sortare (ca `HeaderSortButton`, cu `ArrowUpDown`)
pe **Nr.**, **Termen** și **Stare**. Ține sortarea într-un state local
`{ key: "number" | "deadline" | "status"; dir: "asc" | "desc" } | null`; când e `null` se
păstrează ordinea implicită actuală (nesoluționate primele, apoi după termen). Nu introduce
TanStack aici — lista e simplă, un `sort` propriu e suficient și mai ușor de citit.

**Step 5:** Adaugă coloana de acțiuni și în antet (spacer `w-8`), ca lățimile să se alinieze.

**Step 6:** `npm run build` + `npm test` → verzi.

**Step 7: Commit** `feat(task-manager): petition urgency edge, actions menu and sortable header`

---

## Ordine & dependențe

```
1 (helper-e TDD) → 2 (workspace + filtre) → 3 (sidebar-uri) → 4 (rând: dungă, acțiuni, sortare)
```

## Definition of Done

- [ ] `npm test` verde; `npm run build` fără erori.
- [ ] `/petitii` are aceeași structură ca `/sarcini`: filtre, două sidebar-uri, dungă de accent,
      meniu „⋯", antet sortabil.
- [ ] Drepturile din meniu respectă RLS (editare: admin/creator/responsabil; ștergere: admin/creator).
- [ ] Comportamentele existente rămân (click pe rând = dialog de editare, căutare fără diacritice,
      ordinea implicită).
- [ ] Zero migrări / zero schimbări de RLS. Fără pagină de detaliu.
