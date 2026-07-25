# Task Manager — Roluri (Admin & Member) — Design

**Data:** 2026-07-25
**Autor:** brainstorming cu Claude Code
**Context:** extindere a `apps/task-manager` (Vercel-native, Next.js + Supabase) — vezi
`docs/plans/2026-07-24-task-manager-design.md`.

## Scop

Introducerea a două roluri astfel încât un „șef de secție" (admin) să aibă drepturi
mai mari decât subalternii (member). Coloana `profiles.role` există deja (default `member`).

## Model de roluri

- `profiles.role ∈ { 'admin', 'member' }`.
- Primul admin se setează manual în Supabase (bootstrap, o singură dată).

## Cine ce poate

| Acțiune | Member | Admin |
|---|---|---|
| Creează task | ✅ doar pentru sine (auto-atribuit) | ✅ oricui |
| Editează task | ✅ doar cele create de el / atribuite lui | ✅ orice task |
| Reatribuie (schimbă responsabilul) | ❌ | ✅ |
| Șterge task | ✅ doar cele create de el | ✅ orice task |
| Comentează | ✅ | ✅ |
| Editează/șterge comentariu | ✅ doar ale lui | ✅ ale oricui (moderare) |
| Gestionează roluri (member ↔ admin) | ❌ | ✅ |

## Abordare tehnică

**Aleasă: coloana `role` + funcție `is_admin()` (SECURITY DEFINER) + RLS + gating UI.**
Securitatea reală e impusă de baza de date; UI-ul doar ascunde ce nu e permis.

Alternative respinse:
- Rol în JWT `app_metadata` — mai rapid, dar promovarea cere service-role + refresh de token. Prea multe piese.
- Verificare doar în Server Actions, fără RLS — nesigur (cheia anon ar permite ocolirea).

## Impunere pe 2 straturi

### RLS (Postgres)
Funcție ajutătoare:
```sql
create or replace function is_admin() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer stable;
```

Politici rescrise (înlocuiesc cele permisive actuale):
- **tasks select:** orice autentificat (neschimbat — workspace comun, toți văd tot).
- **tasks insert:** `is_admin() OR (created_by = auth.uid() AND (assignee_id = auth.uid() OR assignee_id is null))` — membrul creează doar pentru sine.
- **tasks update:** `using (is_admin() OR created_by = auth.uid() OR assignee_id = auth.uid())` + `with check (is_admin() OR assignee_id = auth.uid() OR assignee_id is null)` — membrul nu poate reatribui altcuiva.
- **tasks delete:** `using (is_admin() OR created_by = auth.uid())`.
- **comments delete:** `using (is_admin() OR auth.uid() = author_id)`.
- **comments update:** neschimbat (`auth.uid() = author_id`).
- **profiles update:** `using (auth.uid() = id OR is_admin())` — adminul poate schimba rolul oricui; un membru doar propriul profil (dar NU rolul — vezi nota).
  - Notă: pentru a împiedica un membru să-și schimbe singur rolul, restricționăm coloana `role` — fie printr-un trigger care respinge modificarea `role` de către non-admini, fie printr-o politică dedicată. Detaliul se rezolvă în implementare.

Migrarea nouă: `supabase/migrations/0002_roles.sql`.

### UI (cosmetic)
- Ascunde butonul „Șterge" pe task-urile pe care userul nu le poate șterge.
- La membri: câmpul „Responsabil" din formular e blocat pe user-ul curent (fără reatribuire).
- Link-ul și pagina `/admin` apar doar adminului.
- Butonul „Șterge" pe comentariile altora apare doar adminului.

## Pagina `/admin`

- Server Component protejat: dacă `!isAdmin`, `notFound()` / redirect la `/tasks`.
- Listă utilizatori (`profiles`) cu rolul curent + un Select `member ↔ admin` care apelează
  un Server Action `setUserRole(userId, role)` (verifică `is_admin()` + RLS).
- Adăugarea de useri noi rămâne în Supabase (Authentication → Users).

## Cum află UI-ul rolul

- Query nou `getCurrentProfile()` → profilul curent (cu `role`).
- `isAdmin` se pasează în componentele client (tabel, detaliu, comentarii, bară).
- Helper actualizat: `canDeleteComment(userId, isAdmin, comment)` și, eventual,
  `canDeleteTask(userId, isAdmin, task)` / `canEditTask(...)` — funcții pure, testate.

## Testare

- **Unit (Vitest):** helper-ele de permisiuni pentru member vs admin (delete/edit/reassign/moderare).
- **RLS:** verificare manuală în Supabase (nu în build).

## Bootstrap (primul admin)

După deploy, în Supabase SQL Editor:
```sql
update profiles set role = 'admin'
where id = (select id from auth.users where email = 'emailul-tău');
```
