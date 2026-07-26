# Task Manager — Notificări în aplicație — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clopoțel de notificări în aplicație (Supabase) cu timp real: utilizatorul e notificat la atribuire, comentariu, schimbare de stare și editare/ștergere pe sarcinile lui.

**Architecture:** Tabel `notifications` în Postgres. Notificările se creează din Server Actions-urile existente printr-un helper `notify()` care apelează o funcție `SECURITY DEFINER` (`create_notifications`) — fără service-role, RLS strict. Clopoțelul din bară afișează necititele și se actualizează live prin Supabase Realtime. Logica „cine primește" e o funcție pură testată.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Realtime), TypeScript, shadcn/ui, date-fns, Vitest.

**Referință design:** `docs/plans/2026-07-26-task-manager-notifications-design.md`

---

## Convenții & verificare

- App în `apps/task-manager/`. `src/` layout, alias `@/*`. `npm test` = Vitest (`src/**/*.test.ts`).
- Verificare per task: `npm run build` verde, `npm test` verde. Migrarea 0008 o aplică operatorul
  uman în Supabase; verificarea vizuală a clopoțelului (ecran după login) o face utilizatorul.
- Commit după fiecare task. DRY, YAGNI, TDD pentru logica pură.

---

## Task 1: Migrare 0008 — tabel notifications + RLS + RPC + Realtime

**Files:**
- Create: `apps/task-manager/supabase/migrations/0008_notifications.sql`

**Step 1:** Scrie migrarea:
```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('assigned','comment','status','edited','deleted')),
  task_id uuid references tasks(id) on delete set null,
  actor_id uuid references profiles(id) on delete set null,
  actor_name text,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on notifications (user_id, read, created_at desc);

alter table notifications enable row level security;

-- fiecare vede/își modifică/își șterge doar notificările proprii
create policy "notifications select own" on notifications
  for select using (user_id = auth.uid());
create policy "notifications update own" on notifications
  for update using (user_id = auth.uid());
create policy "notifications delete own" on notifications
  for delete using (user_id = auth.uid());
-- fără politică de INSERT: inserarea din client e interzisă; se face doar prin funcția de mai jos

-- creare notificări (SECURITY DEFINER ocolește RLS pentru insert; actor = userul curent)
create or replace function create_notifications(
  p_recipients uuid[],
  p_type text,
  p_task_id uuid,
  p_message text
) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
begin
  select full_name into v_actor_name from profiles where id = v_actor;
  insert into notifications (user_id, type, task_id, actor_id, actor_name, message)
  select r, p_type, p_task_id, v_actor, v_actor_name, p_message
  from unnest(p_recipients) as r
  where r is not null and r <> v_actor;  -- niciodată pe tine însuți
end;
$$;

-- Realtime: publică inserările pe notifications (RLS filtrează per-user)
alter publication supabase_realtime add table notifications;
```

**Step 2:** Documentează în `supabase/README.md` că `0008_notifications.sql` se rulează după 0007.

**Step 3: Commit** `feat(task-manager): notifications table, RLS, RPC, realtime (migration 0008)`

---

## Task 2: Tip + helper-e pure (TDD)

**Files:**
- Modify: `apps/task-manager/src/lib/types.ts`
- Create: `apps/task-manager/src/lib/notifications.ts`
- Create: `apps/task-manager/src/lib/notifications.test.ts`

**Step 1:** În `types.ts` adaugă:
```ts
export type NotificationType = "assigned" | "comment" | "status" | "edited" | "deleted";
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  task_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  message: string;
  read: boolean;
  created_at: string;
}
```

**Step 2 (test first):** `notifications.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { recipientsFor, messageFor } from "./notifications";

const T = { assignee_id: "a" as string | null, created_by: "c" };

describe("recipientsFor", () => {
  it("assigned: doar noul responsabil, dacă nu e actorul", () => {
    expect(recipientsFor("assigned", { assignee_id: "a", created_by: "c" }, "c")).toEqual(["a"]);
  });
  it("assigned: gol dacă responsabilul e chiar actorul", () => {
    expect(recipientsFor("assigned", { assignee_id: "a", created_by: "c" }, "a")).toEqual([]);
  });
  it("assigned: gol dacă nu există responsabil", () => {
    expect(recipientsFor("assigned", { assignee_id: null, created_by: "c" }, "c")).toEqual([]);
  });
  it("comment/status/edited: responsabil + creator, fără actor, dedublați", () => {
    expect(recipientsFor("comment", T, "x").sort()).toEqual(["a", "c"]);
    expect(recipientsFor("status", T, "a")).toEqual(["c"]);
    expect(recipientsFor("edited", { assignee_id: "c", created_by: "c" }, "x")).toEqual(["c"]);
  });
  it("gol dacă singurul vizat e actorul", () => {
    expect(recipientsFor("edited", { assignee_id: null, created_by: "c" }, "c")).toEqual([]);
  });
});

describe("messageFor", () => {
  it("formulează mesaje în română cu titlul", () => {
    expect(messageFor("assigned", "Raport")).toContain("Raport");
    expect(messageFor("comment", "Raport")).toContain("Raport");
    expect(messageFor("status", "Raport", "Finalizat")).toContain("Finalizat");
  });
});
```

**Step 3 (implement):** `notifications.ts`:
```ts
import type { NotificationType } from "./types";

type TaskRef = { assignee_id: string | null; created_by: string };

export function recipientsFor(type: NotificationType, task: TaskRef, actorId: string): string[] {
  if (type === "assigned") {
    return task.assignee_id && task.assignee_id !== actorId ? [task.assignee_id] : [];
  }
  const set = new Set<string>();
  if (task.assignee_id) set.add(task.assignee_id);
  set.add(task.created_by);
  set.delete(actorId);
  return [...set];
}

export function messageFor(type: NotificationType, title: string, statusLabel?: string): string {
  switch (type) {
    case "assigned": return `Ți-a fost atribuită sarcina „${title}"`;
    case "comment": return `Comentariu nou la „${title}"`;
    case "status": return `Starea sarcinii „${title}" s-a schimbat${statusLabel ? `: ${statusLabel}` : ""}`;
    case "edited": return `Sarcina „${title}" a fost modificată`;
    case "deleted": return `Sarcina „${title}" a fost ștearsă`;
  }
}
```

**Step 4:** `npm test -- notifications` → FAIL apoi PASS. Apoi `npm test` tot verde.

**Step 5: Commit** `feat(task-manager): notification recipient/message helpers with tests`

---

## Task 3: Helper server `notify()` + integrare în Server Actions

**Files:**
- Create: `apps/task-manager/src/lib/notify.ts`
- Modify: `apps/task-manager/src/app/tasks/actions.ts`

**Step 1:** `notify.ts` (server-only helper):
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recipientsFor, messageFor } from "@/lib/notifications";
import type { NotificationType } from "@/lib/types";

export async function notify(
  type: NotificationType,
  task: { id: string; title: string; assignee_id: string | null; created_by: string },
  actorId: string,
  statusLabel?: string,
): Promise<void> {
  const recipients = recipientsFor(type, task, actorId);
  if (recipients.length === 0) return;
  const supabase = createClient();
  await supabase.rpc("create_notifications", {
    p_recipients: recipients,
    p_type: type,
    p_task_id: task.id,
    p_message: messageFor(type, task.title, statusLabel),
  });
  // notificările sunt best-effort: nu blocăm acțiunea dacă rpc eșuează
}
```

**Step 2:** Integrează în `actions.ts` (actorul = `userData.user.id`; folosește STATUS_LABEL din
prezentare sau un map local pentru `statusLabel`). Reguli:
- **createTask:** după insert reușit, dacă `assignee_id` setat →
  `await notify("assigned", { id: newTask.id, title, assignee_id, created_by: userId }, userId)`.
- **updateTask:** ÎNAINTE de update, ia rândul vechi:
  `const { data: prev } = await supabase.from("tasks").select("title, status, assignee_id, created_by").eq("id", id).single();`
  După update reușit, calculează un singur eveniment primar (prioritate assigned > status > edited):
  ```ts
  const nt = normalize(parsed.data);
  const task = { id, title: nt.title, assignee_id: nt.assignee_id, created_by: prev.created_by };
  if (nt.assignee_id && nt.assignee_id !== prev.assignee_id) await notify("assigned", task, userId);
  else if (nt.status !== prev.status) await notify("status", task, userId, STATUS_LABEL[nt.status]);
  else await notify("edited", task, userId);
  ```
  (Ai nevoie de `userId` — adaugă `getUser()` la începutul `updateTask`.)
- **deleteTask:** ÎNAINTE de delete, ia `title, assignee_id, created_by`; după delete reușit →
  `notify("deleted", task, userId)`.
- **finalizeTask:** e o schimbare de stare → după update, ia `title, assignee_id, created_by` și
  `notify("status", task, userId, "Finalizat")`.
- **addComment:** după insert reușit, ia sarcina (`title, assignee_id, created_by`) și
  `notify("comment", task, userId)`.
- Adaugă un map local: `const STATUS_LABEL = { todo: "De făcut", in_progress: "În lucru", done: "Finalizat" } as const;`

**Step 3:** `npm run build` → verde.

**Step 4: Commit** `feat(task-manager): emit notifications from task/comment actions`

---

## Task 4: Interogări + acțiuni „marchează citit"

**Files:**
- Modify: `apps/task-manager/src/lib/queries.ts`
- Create: `apps/task-manager/src/app/notifications/actions.ts`

**Step 1:** În `queries.ts`:
```ts
export async function getNotifications(limit = 20): Promise<Notification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as Notification[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  if (error) return 0;
  return count ?? 0;
}
```
(Importă `Notification` din `./types`.)

**Step 2:** `src/app/notifications/actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(id: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return {};
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
  if (error) return { error: error.message };
  revalidatePath("/");
  return {};
}
```

**Step 3:** `npm run build` → verde. **Commit** `feat(task-manager): notification queries + mark-read actions`

---

## Task 5: Clopoțelul (UI) + montare în bară + timp real

**Files:**
- Create: `apps/task-manager/src/components/notifications/notification-bell.tsx`
- Modify: `apps/task-manager/src/app/page.tsx` (și/sau `header-actions` dacă există)

**Step 1:** `notification-bell.tsx` (`"use client"`). Props:
`{ initialItems: Notification[]; initialUnread: number; userId: string }`.
- State: `items`, `unread`. Un `DropdownMenu` cu trigger = buton-icon `Bell` (lucide) + un badge
  cu `unread` (dacă > 0). Conținut: listă `items` (mesaj, `actor_name`, timp relativ cu date-fns
  `ro`), necititele cu fundal accentuat; fiecare item e un `Link` la `/tasks/{task_id}` care la
  click apelează `markNotificationRead(id)` și scade `unread`. Buton „Marchează toate citite"
  (`markAllNotificationsRead()` → `unread=0`, marchează local). Empty state „Nicio notificare".
- **Timp real:** `useEffect` cu clientul browser (`createClient` din `@/lib/supabase/client`):
  ```ts
  const supabase = createClient();
  const channel = supabase
    .channel("notifications")
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => {
        setItems((prev) => [payload.new as Notification, ...prev].slice(0, 20));
        setUnread((u) => u + 1);
      })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
  ```

**Step 2:** Montează clopoțelul în bara de sus. În `page.tsx`, încarcă datele inițiale și pune
clopoțelul lângă restul acțiunilor:
```tsx
const [/*...*/, notifications, unread] = await Promise.all([/*...*/, getNotifications(), getUnreadCount()]);
// în header, înainte de HeaderActions/butoane:
{currentUserId && (
  <NotificationBell initialItems={notifications} initialUnread={unread} userId={currentUserId} />
)}
```
(Dacă bara e extrasă în `header-actions.tsx`, montează-l acolo, primind props din server prin `page.tsx`.)

**Step 3:** `npm run build` → verde.

**Step 4:** Verificare: `/login` la 375px ok; build confirmă structura. Utilizatorul verifică pe
dispozitiv fluxul complet (atribuie o sarcină cu alt cont → clopoțelul crește live).

**Step 5: Commit** `feat(task-manager): notification bell with realtime`

---

## Task 6: Verificare finală + documentație

**Files:**
- Modify: `apps/task-manager/README.md`

**Step 1:** `npm test` (helper-e noi verzi) + `npm run build`.
**Step 2:** În `README.md` adaugă o secțiune scurtă „Notificări" (clopoțel în-app, evenimente,
timp real; migrarea 0008 de aplicat).
**Step 3: Commit** `docs(task-manager): document notifications`

---

## Ordine & dependențe

```
1 (migrare) → 2 (helper-e TDD) → 3 (notify + acțiuni) → 4 (queries/mark-read) → 5 (clopoțel + realtime) → 6 (docs)
```
Task 2 e independent de 1 (pur TS) și poate merge în paralel logic, dar păstrăm ordinea.

## Definition of Done

- [ ] `npm test` verde (recipientsFor/messageFor), `npm run build` fără erori.
- [ ] Migrarea 0008 aplicată în Supabase; Realtime activ pe `notifications`.
- [ ] Manual (utilizator, 2 conturi): atribuire/comentariu/stare/editare/ștergere generează
      notificare la destinatarii corecți (nu la actor); clopoțelul crește live; click marchează citit.
- [ ] Fără regresii pe fluxurile existente.
