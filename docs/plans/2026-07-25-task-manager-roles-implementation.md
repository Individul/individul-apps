# Task Manager — Roluri (Admin & Member) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adaugă roluri `admin`/`member` în task manager: adminul (șef de secție) controlează tot și gestionează rolurile; membrii creează/editează/șterg doar task-urile proprii, fără reatribuire.

**Architecture:** Securitatea reală e impusă în Postgres prin RLS + o funcție `is_admin()`; UI-ul (Next.js) doar ascunde acțiunile nepermise. Rolul curent e citit server-side (`getCurrentProfile`) și pasat ca `isAdmin` în componente. O pagină `/admin` (doar admin) permite promovarea/retrogradarea.

**Tech Stack:** Next.js 14.1 App Router, Supabase (Postgres + RLS), TypeScript, shadcn/ui, Vitest.

**Referință design:** `docs/plans/2026-07-25-task-manager-roles-design.md`

---

## Convenții

- App-ul e în `apps/task-manager/`; rulează comenzile de acolo.
- `src/` layout, alias `@/*` → `./src/*`. `npm test` = Vitest (doar `src/**/*.test.ts`).
- Verificare per task: `npm run build` trebuie să treacă. RLS-ul se verifică manual în Supabase.
- Commit după fiecare task.

---

## Task 1: Migrare RLS pentru roluri

**Files:**
- Create: `apps/task-manager/supabase/migrations/0002_roles.sql`

**Step 1:** Scrie migrarea (înlocuiește politicile permisive actuale cu unele conștiente de rol):

```sql
-- Funcție ajutătoare: userul curent e admin?
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ===== tasks =====
-- insert: adminul creează oricui; membrul doar pentru sine
drop policy if exists "tasks insert authenticated" on tasks;
create policy "tasks insert" on tasks
  for insert with check (
    is_admin()
    or (created_by = auth.uid() and (assignee_id = auth.uid() or assignee_id is null))
  );

-- update: adminul orice; membrul doar own/assigned, fără reatribuire către altcineva
drop policy if exists "tasks update authenticated" on tasks;
create policy "tasks update" on tasks
  for update using (
    is_admin() or created_by = auth.uid() or assignee_id = auth.uid()
  ) with check (
    is_admin() or assignee_id = auth.uid() or assignee_id is null
  );

-- delete: adminul orice; membrul doar cele create de el
drop policy if exists "tasks delete authenticated" on tasks;
create policy "tasks delete" on tasks
  for delete using (is_admin() or created_by = auth.uid());

-- ===== comments =====
-- delete: autorul sau adminul (moderare)
drop policy if exists "comments delete own" on comments;
create policy "comments delete" on comments
  for delete using (is_admin() or auth.uid() = author_id);

-- ===== profiles =====
-- update: propriul profil sau adminul (pentru schimbarea rolului)
drop policy if exists "update own profile" on profiles;
create policy "profiles update" on profiles
  for update using (auth.uid() = id or is_admin());

-- împiedică un non-admin să-și schimbe singur rolul
create or replace function prevent_role_change_by_non_admin() returns trigger as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Doar adminul poate schimba rolul.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard before update on profiles
  for each row execute function prevent_role_change_by_non_admin();
```

**Step 2:** Documentează în `supabase/README.md` că această migrare se rulează în SQL Editor (după `0001_init.sql`).

**Step 3:** Commit: `feat(task-manager): RLS roles migration (is_admin, task/comment/profile policies)`

*(Aplicarea efectivă în Supabase o face operatorul uman — vezi Task 8.)*

---

## Task 2: Helper-e de permisiuni (TDD)

**Files:**
- Modify: `apps/task-manager/src/lib/permissions.ts`
- Modify: `apps/task-manager/src/lib/permissions.test.ts`

**Step 1: Adaugă testele (fail first)** în `permissions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  canEditComment,
  canDeleteComment,
  canDeleteTask,
  canEditTask,
  canReassignTask,
} from "./permissions";

const task = (over: Partial<{ created_by: string; assignee_id: string | null }>) => ({
  created_by: "owner",
  assignee_id: null as string | null,
  ...over,
});

describe("canDeleteTask", () => {
  it("adminul poate șterge orice", () => expect(canDeleteTask("x", true, task({}))).toBe(true));
  it("creatorul poate șterge", () => expect(canDeleteTask("owner", false, task({}))).toBe(true));
  it("altcineva nu poate", () => expect(canDeleteTask("other", false, task({}))).toBe(false));
  it("asignatul (dar nu creator) nu poate șterge", () =>
    expect(canDeleteTask("a", false, task({ assignee_id: "a" }))).toBe(false));
});

describe("canEditTask", () => {
  it("adminul poate edita orice", () => expect(canEditTask("x", true, task({}))).toBe(true));
  it("creatorul poate edita", () => expect(canEditTask("owner", false, task({}))).toBe(true));
  it("asignatul poate edita", () =>
    expect(canEditTask("a", false, task({ assignee_id: "a" }))).toBe(true));
  it("altcineva nu poate", () => expect(canEditTask("other", false, task({}))).toBe(false));
});

describe("canReassignTask", () => {
  it("doar adminul poate reatribui", () => {
    expect(canReassignTask(true)).toBe(true);
    expect(canReassignTask(false)).toBe(false);
  });
});

describe("canDeleteComment", () => {
  it("autorul poate", () => expect(canDeleteComment("u1", false, { author_id: "u1" })).toBe(true));
  it("adminul poate șterge al oricui", () =>
    expect(canDeleteComment("u2", true, { author_id: "u1" })).toBe(true));
  it("alt user non-admin nu poate", () =>
    expect(canDeleteComment("u2", false, { author_id: "u1" })).toBe(false));
});
```

**Step 2:** Run `npm test -- permissions` → FAIL (funcții inexistente).

**Step 3:** Implementează în `permissions.ts` (păstrează `canEditComment` existent):

```ts
export function canEditComment(userId: string, comment: { author_id: string }): boolean {
  return userId === comment.author_id;
}

export function canDeleteComment(
  userId: string,
  isAdmin: boolean,
  comment: { author_id: string },
): boolean {
  return isAdmin || userId === comment.author_id;
}

export function canDeleteTask(
  userId: string,
  isAdmin: boolean,
  task: { created_by: string },
): boolean {
  return isAdmin || userId === task.created_by;
}

export function canEditTask(
  userId: string,
  isAdmin: boolean,
  task: { created_by: string; assignee_id: string | null },
): boolean {
  return isAdmin || userId === task.created_by || userId === task.assignee_id;
}

export function canReassignTask(isAdmin: boolean): boolean {
  return isAdmin;
}
```

**Step 4:** Run `npm test -- permissions` → PASS. Apoi `npm test` (toate).

**Step 5:** Commit: `feat(task-manager): role-aware permission helpers with tests`

---

## Task 3: getCurrentProfile + propagă isAdmin

**Files:**
- Modify: `apps/task-manager/src/lib/queries.ts`
- Modify: `apps/task-manager/src/app/tasks/page.tsx`
- Modify: `apps/task-manager/src/app/tasks/[id]/page.tsx`

**Step 1:** Adaugă în `queries.ts`:

```ts
import type { Task, Profile, Tag, Comment } from "./types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Profile | null;
}
```

**Step 2:** În `tasks/page.tsx`: încarcă profilul curent și derivă `isAdmin`:
```tsx
const [tasks, profiles, currentProfile] = await Promise.all([
  getTasks(), getProfiles(), getCurrentProfile(),
]);
const currentUserId = currentProfile?.id ?? null;
const isAdmin = currentProfile?.role === "admin";
```
Pasează `isAdmin` la `<TaskTable ... isAdmin={isAdmin} />`. Afișează link „Administrare" (`/admin`) în bară doar dacă `isAdmin`.

**Step 3:** În `tasks/[id]/page.tsx`: la fel, obține `isAdmin` din `getCurrentProfile()` și pasează-l la `<TaskDetail ... isAdmin={isAdmin} />`.

**Step 4:** `npm run build` → OK.

**Step 5:** Commit: `feat(task-manager): fetch current role, pass isAdmin to pages`

---

## Task 4: Gate ștergere/editare task în tabel

**Files:**
- Modify: `apps/task-manager/src/components/tasks/task-table.tsx`
- Modify: `apps/task-manager/src/components/tasks/columns.tsx`

**Step 1:** `task-table.tsx`: adaugă prop `isAdmin: boolean`. Pasează `isAdmin` + `currentUserId` în `makeColumns`.

**Step 2:** `columns.tsx`: `makeColumns({ onEdit, onDelete, currentUserId, isAdmin })`. În celula de acțiuni, folosește helper-ele:
- afișează „Editează" doar dacă `canEditTask(currentUserId, isAdmin, task)`;
- afișează „Șterge" doar dacă `canDeleteTask(currentUserId, isAdmin, task)`;
- dacă niciuna nu e permisă, nu randa meniul (sau randează un `—`).
Importă din `@/lib/permissions`. `currentUserId` poate fi `null` → tratează ca „nimic permis" (dar userul e mereu logat aici).

**Step 3:** `npm run build` → OK.

**Step 4:** Commit: `feat(task-manager): gate task edit/delete by role in table`

---

## Task 5: Blochează responsabilul pentru membri în formular

**Files:**
- Modify: `apps/task-manager/src/components/tasks/task-form-dialog.tsx`
- Modify: `apps/task-manager/src/components/tasks/task-table.tsx` (pasează props)

**Step 1:** `task-form-dialog.tsx`: adaugă props `isAdmin: boolean` și `currentUserId: string | null`.
- La CREARE ca membru (`!isAdmin`): forțează `assignee_id = currentUserId` și randează câmpul „Responsabil" dezactivat (arată numele userului curent), fără posibilitate de schimbare.
- La EDITARE ca membru: câmpul „Responsabil" e dezactivat (nu poate reatribui) — `canReassignTask(isAdmin)` controlează dacă select-ul e activ.
- Adminul: comportament actual (select complet).

**Step 2:** `task-table.tsx`: pasează `isAdmin` + `currentUserId` la `<TaskFormDialog />`. (Detaliul task-ului, dacă deschide dialogul de editare, la fel — vezi Task 6.)

**Step 3:** `npm run build` → OK.

**Step 4:** Commit: `feat(task-manager): lock assignee for members in task form`

---

## Task 6: Moderare comentarii + gating în detaliu

**Files:**
- Modify: `apps/task-manager/src/components/tasks/task-detail.tsx`
- Modify: `apps/task-manager/src/components/tasks/comments.tsx`

**Step 1:** `task-detail.tsx`: adaugă prop `isAdmin`. Pasează-l la `TaskFormDialog` (pentru butonul „Editează", care poate rămâne vizibil doar dacă `canEditTask`) și la `<Comments ... isAdmin={isAdmin} />`. Butonul „Editează"/„Șterge" pentru task în detaliu respectă `canEditTask`/`canDeleteTask`.

**Step 2:** `comments.tsx`: adaugă prop `isAdmin`. Înlocuiește gate-ul de ștergere cu `canDeleteComment(currentUserId, isAdmin, comment)`; editarea rămâne doar pentru autor (`canEditComment`). Importă `canDeleteComment`.

**Step 3:** `npm run build` → OK.

**Step 4:** Commit: `feat(task-manager): comment moderation + role gating in detail`

---

## Task 7: Pagina de administrare `/admin`

**Files:**
- Create: `apps/task-manager/src/app/admin/page.tsx`
- Create: `apps/task-manager/src/app/admin/actions.ts`
- Create: `apps/task-manager/src/components/admin/user-role-table.tsx`

**Step 1:** `admin/actions.ts` — Server Action pentru schimbarea rolului:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setUserRole(
  userId: string,
  role: "admin" | "member",
): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Fără permisiune sau utilizator inexistent." };
  revalidatePath("/admin");
  return { success: true };
}
```
(RLS + triggerul asigură că doar adminul poate efectiv schimba rolul.)

**Step 2:** `admin/page.tsx` — Server Component protejat:
```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile, getProfiles } from "@/lib/queries";
import { UserRoleTable } from "@/components/admin/user-role-table";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") redirect("/tasks");
  const profiles = await getProfiles();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Administrare utilizatori</h1>
      <UserRoleTable profiles={profiles} currentUserId={me.id} />
    </main>
  );
}
```

**Step 3:** `user-role-table.tsx` (`"use client"`) — tabel cu utilizatori (nume/email dacă e disponibil, rol) + un Select `member/admin` per rând care apelează `setUserRole` în `useTransition`, `toast` la eroare, `router.refresh()` la succes. Dezactivează comutatorul pentru propriul rând (adminul să nu se auto-retrogradeze accidental — opțional dar recomandat).

**Step 4:** `npm run build` → OK (verifică că `/admin` apare ca rută).

**Step 5:** Commit: `feat(task-manager): admin page for managing user roles`

---

## Task 8: Bootstrap + documentație

**Files:**
- Modify: `apps/task-manager/supabase/README.md`
- Modify: `apps/task-manager/README.md`

**Step 1:** În `supabase/README.md`: adaugă pașii pentru roluri:
- rulează `migrations/0002_roles.sql` după `0001_init.sql`;
- setează primul admin:
  ```sql
  update profiles set role = 'admin'
  where id = (select id from auth.users where email = 'emailul-tău');
  ```

**Step 2:** În `README.md` (app): adaugă o secțiune „Roluri" care rezumă tabelul admin vs member și menționează pagina `/admin`.

**Step 3:** Commit: `docs(task-manager): document roles setup + admin bootstrap`

---

## Ordine & dependențe

```
1 (RLS) → 2 (helpers) → 3 (isAdmin) → 4 (tabel) → 5 (form) → 6 (comentarii/detaliu) → 7 (/admin) → 8 (docs)
```
- Task 2 (helper-e) e independent și poate merge imediat după 1.
- Task 3 (isAdmin) e prerechizit pentru 4-7.

## Definition of Done

- [ ] `npm test` verde (helper-e noi testate).
- [ ] `npm run build` fără erori; rută `/admin` prezentă.
- [ ] `0002_roles.sql` aplicat în Supabase; primul admin setat.
- [ ] Manual: un membru nu vede „Șterge" pe task-uri străine, nu poate reatribui, nu vede `/admin`; adminul le poate pe toate.
