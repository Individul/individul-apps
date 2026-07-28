# Petiții — aliniere UI/UX la pagina de sarcini — Design

**Data:** 2026-07-28
**Autor:** brainstorming cu Claude Code
**Context:** `apps/task-manager` are două module. Rândurile din `/petitii` sunt deja aliniate
la cele din `/sarcini` (același container, spațiere, avataruri colorate, puncte de stare), dar
**structura paginii** diferă: petițiile au doar căutare + listă.

## Scop

Aceeași experiență de lucru în ambele module: aceleași unelte, în aceleași locuri.

## Diferențe de acoperit

| Element | Sarcini | Petiții (acum) |
|---|---|---|
| Dungă de accent pe marginea rândului | ✅ prioritate | ❌ |
| Bară de filtre (stare, responsabil, „ale mele") | ✅ | doar căutare |
| Sidebar stânga — vizualizări rapide cu contoare | ✅ | ❌ |
| Sidebar dreapta — Rezumat + Pe responsabil | ✅ | ❌ |
| Meniu acțiuni „⋯" | ✅ | ❌ (click pe rând = editare) |
| Antet sortabil | ✅ | ❌ (ordine fixă) |

## Soluție

### 1. Structura paginii
Component nou `PetitionsWorkspace`, oglindă la `TasksWorkspace`: pe `lg:` trei coloane
(vizualizări rapide `w-56` · listă `flex-1` · statistici `w-80`), stivuite pe ecran mic.
Starea de filtrare trăiește în workspace și se pasează în jos, exact ca la sarcini.

### 2. Dungă de urgență (echivalentul priorității)
Petițiile nu au prioritate, dar au termen de răspuns — deci accentul redă **urgența**:

| Situație | Culoare |
|---|---|
| Restant (termen trecut, în examinare) | roșu |
| Scadent în ≤5 zile | ambră |
| În examinare, fără urgență | neutru (slate) |
| Soluționat | verde |

Se refolosește `daysUntil` din `components/petitions/meta.ts` (există deja).

### 3. Bară de filtre (`PetitionFiltersBar`)
Căutarea actuală + select **Stare** + select **Responsabil** + toggle **„Doar ale mele"** +
butonul „Petiție nouă" (la dreapta). Filtrarea se face printr-un helper pur testat
`filterPetitions(petitions, filter)` — oglindă la `filterTasks`, cu căutare fără diacritice
(`fold`, deja existentă).

### 4. Vizualizări rapide (stânga), cu contoare
Toate · Ale mele · Restante · Scadente 5 zile · În examinare · Soluționate.
Fiecare setează filtrul corespunzător, ca la sarcini.

### 5. Statistici (dreapta)
- **Rezumat** — Total, În examinare, Soluționate, Restante + bară de progres.
- **Pe responsabil** — avatar + nume + număr, cu restanțele în roșu (ca pe hub).
  Se refolosește `countsByAssignee` + `isPetitionOverdue` din `src/lib/hub-stats.ts`.

### 6. Meniu acțiuni „⋯"
Pe fiecare rând: **Editează** (deschide dialogul existent), **Șterge** (confirmare +
`deletePetition`). Drepturile respectă RLS-ul deja existent din `0012_petitions.sql`:

- editare: `is_admin() or created_by = auth.uid() or assignee_id = auth.uid()`
- ștergere: `is_admin() or created_by = auth.uid()`

Se adaugă helper-e pure testate în `src/lib/permissions.ts`: `canEditPetition`, `canDeletePetition`.

### 7. Antet sortabil
Nr. · Termen · Stare. Ordinea implicită rămâne cea actuală (nesoluționate primele, apoi după
termen), ca să nu se schimbe comportamentul cu care s-a obișnuit lumea.

## Ce NU facem acum

- **Fără pagină de detaliu** pentru petiții (`/petitii/[id]`) — clicul pe rând deschide în
  continuare dialogul de editare. Se va adăuga la nevoie, ulterior.
- Fără migrări, fără schimbări de RLS sau de logică de business.

## Testare

- **Unit (Vitest):** `filterPetitions` (stare, responsabil, căutare fără diacritice, combinat,
  gol) și `canEditPetition` / `canDeletePetition` (admin, creator, responsabil, străin).
- **Build** verde; verificarea vizuală o face utilizatorul după deploy (ecran autentificat).

## Fișiere afectate (estimare)

- Nou: `src/lib/petition-filters.ts` (+ test), `src/components/petitions/petitions-workspace.tsx`,
  `petition-filters-bar.tsx`, `petition-quick-views.tsx`, `petition-summary.tsx`,
  `petition-assignee-breakdown.tsx`.
- Modificate: `src/components/petitions/petitions-list.tsx` (dungă, meniu acțiuni, antet sortabil,
  primește filtrul din workspace), `src/lib/permissions.ts` (+ test), `src/app/petitii/page.tsx`
  (randează workspace-ul).
