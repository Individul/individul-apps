# Task Manager — Notificări în aplicație — Design

**Data:** 2026-07-26
**Autor:** brainstorming cu Claude Code
**Context:** `apps/task-manager` (Next.js + Supabase, Vercel-native). Vezi și
`docs/plans/2026-07-24-task-manager-design.md`.

## Scop

Un sistem de notificări **în aplicație** (clopoțel 🔔) pentru echipă (4-5 oameni): utilizatorul
vede când i se atribuie o sarcină, când se comentează / se schimbă starea / se editează sau șterge
o sarcină a lui. Actualizare **în timp real** (Supabase Realtime — gratuit la scara asta).

## Decizii (din brainstorming)

| Întrebare | Decizie |
|-----------|---------|
| Canal | Doar în aplicație (clopoțel). Fără email/push/cron deocamdată. |
| Evenimente | Atribuire, comentariu, schimbare stare, editare/ștergere |
| Destinatari | Responsabilul + creatorul sarcinii, **minus actorul**, dedublați. La „atribuire" → doar noul responsabil. |
| Timp real | **Da, în MVP** (Supabase Realtime) |
| Notificări pentru admini | Nu (regula standard de mai sus) |

## Model de date

Tabel `notifications`:
- `id` uuid PK
- `user_id` uuid → profiles (destinatarul)
- `type` text: `assigned` | `comment` | `status` | `edited` | `deleted`
- `task_id` uuid → tasks (nullable, on delete set null — pentru link direct)
- `actor_id` uuid → profiles (cine a provocat), `actor_name` text (denormalizat, pentru afișare)
- `message` text (formulat în română, gata de afișat)
- `read` boolean default false
- `created_at` timestamptz default now()
- Index pe `(user_id, read, created_at desc)` pentru query-ul clopoțelului.

## Cine primește (regula)

Pentru un eveniment pe o sarcină:
- destinatari = { `assignee_id`, `created_by` } − { actor } , dedublați;
- excepție „assigned": doar noul `assignee_id` (dacă e altcineva decât actorul);
- dacă lista rămâne goală, nu se creează nimic.

Funcție pură testabilă `recipientsFor(event, task, actorId)` → `string[]`.

## Cum se creează notificările

În Server Actions-urile existente (singura cale de scriere):
- `createTask` — dacă `assignee_id` e setat la altcineva decât actorul → `assigned`.
- `updateTask` — compară vechi/nou: dacă s-a schimbat `assignee_id` → `assigned` (noul responsabil);
  dacă s-a schimbat `status` → `status`; alte modificări → `edited`.
- `addComment` — `comment` către responsabil + creator (minus autorul comentariului).
- `deleteTask` — `deleted` către responsabil + creator (minus actor).

Un helper server `notify(recipients, type, taskId, message)` inserează rândurile printr-o
**funcție Postgres `SECURITY DEFINER`** `create_notifications(recipient_ids uuid[], type, task_id, message)`
cu `actor = auth.uid()`. Astfel nu e nevoie de cheia service-role, iar RLS rămâne strict.
Logica „cine primește" + formularea mesajului stau în TS (ușor de testat/citit).

*(Alternativă respinsă: trigger-e în DB — mai robuste, dar mai greu de formulat mesajele în română
și de testat. Toate scrierile trec oricum prin Server Actions.)*

## UI — clopoțelul

`NotificationBell` (client, în bara de sus, lângă restul acțiunilor):
- badge cu numărul de **necitite**;
- panou (dropdown) cu ultimele ~20 notificări: mesaj + timp relativ (`date-fns`, `ro`), necititele evidențiate;
- click pe o notificare → o marchează citită + navighează la `/tasks/{task_id}`;
- buton „Marchează toate citite".
- Datele inițiale (count + listă) vin din server (în `page.tsx` / layout), pasate ca props.

Server Actions noi: `markNotificationRead(id)`, `markAllNotificationsRead()`.
Query nou: `getNotifications(limit)` + `getUnreadCount()` (sau o singură interogare).

## Timp real (în MVP)

`NotificationBell` se abonează prin **Supabase Realtime** la `INSERT`-urile pe `notifications`
filtrate pe `user_id = <eu>`. La un insert nou → prepend în listă + incrementează badge, fără refresh.
Se folosește clientul browser Supabase (`createClient` din `@/lib/supabase/client`).

## RLS

Pe `notifications`:
- `select` / `update` / `delete`: doar `user_id = auth.uid()`.
- `insert` direct: interzis din client — inserarea se face doar prin funcția `SECURITY DEFINER`.
- Realtime respectă RLS (fiecare primește doar inserările pentru el).

## Testare

- **Unit (Vitest):** `recipientsFor(event, task, actorId)` — atribuire (doar noul responsabil),
  comentariu/stare/editare (responsabil + creator fără actor), dedublare, listă goală când doar
  actorul ar fi vizat.
- **Build** verde. Verificarea vizuală a clopoțelului + timp real o face utilizatorul pe dispozitiv
  (ecranul e după login).

## Migrare

`supabase/migrations/0008_notifications.sql`: tabel + index + RLS + funcția `create_notifications`.
Se aplică în Supabase după migrările existente (0001–0007).

## Fișiere afectate (estimare)

- Nou: migrarea 0008; `src/lib/notifications.ts` (helper `recipientsFor` + formulare mesaje) +
  test; `src/app/notifications/actions.ts` (mark read); `src/components/notifications/notification-bell.tsx`.
- Modificate: `src/lib/queries.ts` (getNotifications/getUnreadCount), `src/app/tasks/actions.ts`
  (apeluri `notify`), `src/lib/types.ts` (tip `Notification`), `src/app/page.tsx` + header (montează clopoțelul).
