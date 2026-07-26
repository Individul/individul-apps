# Task Manager — Lustruire listă de sarcini (tabel rafinat) — Design

**Data:** 2026-07-26
**Autor:** brainstorming cu Claude Code (cu mockup vizual aprobat)
**Context:** `apps/task-manager` — ecranul principal (`/`) arăta „standard". Aleasă direcția
**A — tabel rafinat**: păstrăm tabelul sortabil, dar îl facem elegant.

## Scop

Ecranul principal să arate „proiectat", nu default-shadcn, păstrând funcționalitatea
(sortare, filtre, quick views, roluri). Fără schimbări de date/RLS — pur prezentare.

## Ce se schimbă (rândurile tabelului)

Pe baza mockup-ului aprobat (direcția A):
- **Prioritatea → dungă de accent** pe marginea stângă a fiecărui rând (3px, colț pătrat):
  ridicată = roșu (`--text-danger`), medie = ambră (`--text-warning`), scăzută = neutru
  (`--border-strong`). Înlocuiește coloana-badge de prioritate (mai puțin zgomot).
- **Starea → punct + etichetă** (mai discret decât badge plin): De făcut = gri
  (`--text-muted`), În lucru = albastru (`--text-accent`), Finalizat = verde
  (`--text-success`). Rămâne coloană sortabilă.
- **Titlul** — mai puternic (500), linkul la detaliu; sub el, starea + chip-urile de etichete.
- **Responsabil** — avatar (inițiale, cerc cu tentă de accent) + nume prescurtat.
- **Termen** — roșu dacă e depășit și nefinalizat (deja există logica).
- **Rând** — hover subtil (`--surface-1`), înălțime confortabilă, spațiere mai generoasă,
  separatoare hairline (`0.5px --border`) în loc de borduri dure.
- **Container** — colțuri 12px, bordură `0.5px`, fundal `--surface-2`; empty state îngrijit
  („Nicio sarcină." centrat, muted).
- **Etichetele** — chip-uri rotunjite, culoarea etichetei ca fundal cu text lizibil.

Sortarea rămâne pe **Termen** și **Stare** (și titlu). Prioritatea e vizibilă prin dungă și
filtrabilă din bara existentă + quick views, deci nu pierdem capabilitatea.

## Lustruire transversală (ca pagina să fie coerentă)

- **Bara de sus / toolbar** — spațiere și aliniere mai bune; „Sarcină nouă" ca buton principal cu
  accent; search cu iconiță; grup de filtre aerisit.
- **Carduri de statistici din sidebar** (`TaskSummary`, `AssigneeBreakdown`, `TagsPanel`) —
  stil coerent de „metric card": etichetă mică muted deasupra, număr mare (24px/500) dedesubt,
  fundal `--surface-1`, colțuri, spațiere consistentă.
- **Tokens de spațiere/tipografie** — două greutăți (400/500), sentence case, culori din tokens
  (dark-mode safe).

## Abordare tehnică

- Doar **Tailwind + tokens shadcn** deja existente. Fără librării noi.
- Modific `columns.tsx` (render-ul celulelor: dungă de prioritate, punct de stare, avatar, chip-uri)
  și `task-table.tsx` (container, hover, spacing, empty state). Refolosesc `STATUS_META`/
  `PRIORITY_META` existente (adaptez culorile la punct/dungă).
- Sidebar: mici ajustări de stil în `task-summary.tsx`, `assignee-breakdown.tsx`, `tags-panel.tsx`.
- Toolbar: ajustări în `task-filters-bar.tsx`.
- Nu ating logica de sortare/filtrare/roluri/acțiuni.

## Alternative respinse (din mockup)

- **B (carduri)** și **C (grupare pe stări)** — respinse acum; A dă cel mai bun raport efort/impact.
  (Cardurile pot reveni pentru mobil, în planul parcat `feat/task-manager-mobile`.)

## Testare

- **Build** verde; **`npm test`** verde (fără logică nouă, dar suita rămâne verde).
- Verificare vizuală: ecranul e după login → utilizatorul confirmă pe dispozitiv/după deploy.
  Eu verific structura prin build + pagina publică.

## Fișiere afectate (estimare)

- `src/components/tasks/columns.tsx` (render celule)
- `src/components/tasks/task-table.tsx` (container, hover, empty state, spacing)
- `src/components/tasks/task-filters-bar.tsx` (toolbar polish)
- `src/components/tasks/{task-summary,assignee-breakdown,tags-panel}.tsx` (metric cards)
- eventual `src/app/page.tsx` (spacing header)
