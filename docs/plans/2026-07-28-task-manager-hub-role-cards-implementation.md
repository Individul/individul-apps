# Carduri hub conștiente de rol — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Pe hub, adminul vede cifrele globale plus defalcarea pe persoană, iar membrul vede doar cifrele elementelor atribuite lui.

**Architecture:** Un helper pur nou (`countsByAssignee`) grupează elementele pe responsabil; hub-ul filtrează lista pentru membri înainte de statisticile existente și pasează defalcarea doar pentru admini. `ModuleCard` primește un prop opțional `breakdown`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind + shadcn, Vitest.

**Referință design:** `docs/plans/2026-07-28-task-manager-hub-role-cards-design.md`

---

## Convenții

- App în `apps/task-manager/`. `npm test` = Vitest (43 teste acum). Verificare: `npm run build` + `npm test`.
- Zero migrări, zero RLS. Commit după fiecare task.

---

## Task 1: Helper `countsByAssignee` (TDD)

**Files:**
- Modify: `apps/task-manager/src/lib/hub-stats.ts`
- Modify: `apps/task-manager/src/lib/hub-stats.test.ts`

**Step 1: Write the failing test** — adaugă la finalul `hub-stats.test.ts`:

```ts
import { countsByAssignee } from "./hub-stats";
import type { Profile } from "./types";

const prof = (id: string, name: string | null): Profile => ({
  id, full_name: name, username: null, avatar_url: null, role: "member",
});

describe("countsByAssignee", () => {
  const profiles = [prof("a", "Ana"), prof("b", "Bogdan")];

  it("grupează și sortează descrescător", () => {
    const r = countsByAssignee(
      [{ assignee_id: "b" }, { assignee_id: "a" }, { assignee_id: "b" }],
      profiles,
    );
    expect(r).toEqual([
      { id: "b", name: "Bogdan", count: 2 },
      { id: "a", name: "Ana", count: 1 },
    ]);
  });

  it("pune Neatribuit la final", () => {
    const r = countsByAssignee(
      [{ assignee_id: null }, { assignee_id: null }, { assignee_id: "a" }],
      profiles,
    );
    expect(r.map((x) => x.name)).toEqual(["Ana", "Neatribuit"]);
    expect(r[1].count).toBe(2);
  });

  it("tratează profil lipsă ca Neatribuit", () => {
    const r = countsByAssignee([{ assignee_id: "zzz" }], profiles);
    expect(r).toEqual([{ id: null, name: "Neatribuit", count: 1 }]);
  });

  it("nume lipsă → (fără nume)", () => {
    const r = countsByAssignee([{ assignee_id: "c" }], [prof("c", null)]);
    expect(r[0].name).toBe("(fără nume)");
  });

  it("la egalitate sortează alfabetic", () => {
    const r = countsByAssignee([{ assignee_id: "b" }, { assignee_id: "a" }], profiles);
    expect(r.map((x) => x.name)).toEqual(["Ana", "Bogdan"]);
  });

  it("listă goală", () => {
    expect(countsByAssignee([], profiles)).toEqual([]);
  });
});
```
(Importurile `describe/it/expect` există deja în fișier — nu le dubla; adaugă doar ce lipsește.)

**Step 2: Run test to verify it fails**

Run: `npm test -- hub-stats`
Expected: FAIL — `countsByAssignee is not a function`.

**Step 3: Write minimal implementation** — adaugă în `hub-stats.ts`:

```ts
import type { Task, Petition, Profile } from "./types";

export interface AssigneeCount {
  id: string | null;
  name: string;
  count: number;
}

const UNASSIGNED = "Neatribuit";

export function countsByAssignee(
  items: { assignee_id: string | null }[],
  profiles: Profile[],
): AssigneeCount[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const counts = new Map<string | null, number>();

  for (const item of items) {
    const key = item.assignee_id && byId.has(item.assignee_id) ? item.assignee_id : null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rows: AssigneeCount[] = [...counts].map(([id, count]) => ({
    id,
    name: id ? byId.get(id)!.full_name ?? "(fără nume)" : UNASSIGNED,
    count,
  }));

  return rows.sort((a, b) => {
    if (a.id === null) return 1; // Neatribuit mereu la final
    if (b.id === null) return -1;
    return b.count - a.count || a.name.localeCompare(b.name, "ro");
  });
}
```
(Adaugă `Profile` la importul de tipuri existent — nu crea un import nou.)

**Step 4: Run test to verify it passes**

Run: `npm test -- hub-stats` → PASS. Apoi `npm test` → toate verzi (43 + 6 = 49).

**Step 5: Commit**

```bash
git add src/lib/hub-stats.ts src/lib/hub-stats.test.ts
git commit -m "feat(task-manager): countsByAssignee helper with tests"
```

---

## Task 2: Carduri conștiente de rol

**Files:**
- Modify: `apps/task-manager/src/components/hub/module-card.tsx`
- Modify: `apps/task-manager/src/app/page.tsx`

**Step 1:** `module-card.tsx` — adaugă prop opțional `breakdown`:

```tsx
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatar-color";
import type { AssigneeCount } from "@/lib/hub-stats";
```
În semnătură: `breakdown?: AssigneeCount[]`. După grila de cifre, randează (doar dacă
`breakdown && breakdown.length > 0`):

```tsx
<div className="mt-5 space-y-2 border-t pt-4">
  {breakdown.map((row) => (
    <div key={row.id ?? "none"} className="flex items-center gap-2 text-sm">
      <Avatar className="h-6 w-6">
        <AvatarFallback className={cn("text-[10px]", avatarColor(row.id ?? "none"))}>
          {initialsOf(row.name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{row.name}</span>
      <span className="ml-auto tabular-nums text-muted-foreground">{row.count}</span>
    </div>
  ))}
</div>
```
Pentru inițiale: `initials` e exportat din `@/components/tasks/columns` — dacă importul din
`hub/` spre `tasks/` pare nepotrivit, definește local o funcție mică `initialsOf(name)`
(2 litere, fallback „?"). Alege varianta curată și menține-o consistentă.

**Step 2:** `src/app/page.tsx` — calculează în funcție de rol:

```tsx
const isAdmin = profile?.role === "admin";
const me = profile?.id ?? null;

const myTasks = isAdmin ? tasks : tasks.filter((t) => t.assignee_id === me);
const myPetitions = isAdmin ? petitions : petitions.filter((p) => p.assignee_id === me);

const ts = taskStats(myTasks);
const ps = petitionStats(myPetitions);

// defalcare doar pentru admin, peste elementele relevante (nefinalizate / în examinare)
const taskBreakdown = isAdmin
  ? countsByAssignee(tasks.filter((t) => t.status !== "done"), profiles)
  : undefined;
const petitionBreakdown = isAdmin
  ? countsByAssignee(petitions.filter((p) => p.status === "in_examinare"), profiles)
  : undefined;
```
Ai nevoie de `getProfiles()` în `Promise.all` (verifică — hub-ul nu-l încarcă acum) și de
importul `countsByAssignee`.

Pasează `breakdown={taskBreakdown}` / `breakdown={petitionBreakdown}` la carduri și adaptează
descrierile:
```tsx
description={isAdmin
  ? "Evidența sarcinilor echipei, cu termene și responsabili."
  : "Sarcinile atribuite ție, cu termene și priorități."}
```
```tsx
description={isAdmin
  ? "Registrul petițiilor, cu termene de răspuns."
  : "Petițiile atribuite ție, cu termene de răspuns."}
```

**Step 3:** `npm run build` + `npm test` → verzi.

**Step 4: Commit** `feat(task-manager): role-aware hub cards with per-user breakdown`

---

## Ordine & dependențe

```
1 (helper TDD) → 2 (carduri + hub)
```

## Definition of Done

- [ ] `npm test` verde (49); `npm run build` fără erori.
- [ ] Admin: cifre globale + listă pe persoană pe ambele carduri.
- [ ] Membru: cifre doar peste ce-i e atribuit, fără listă, descriere adaptată.
- [ ] Zero migrări / zero schimbări de RLS; listele `/sarcini` și `/petitii` neschimbate.
