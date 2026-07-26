# Task Manager — Lustruire listă (tabel rafinat) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ecranul principal (`/`) arată elegant, nu default-shadcn: rânduri rafinate cu dungă de prioritate, stare ca punct+etichetă, avataruri, hover, spațiere; carduri de statistici coerente. Fără schimbări de date/RLS.

**Architecture:** Pur prezentare — doar Tailwind + tokens shadcn existente. Se modifică render-ul din `columns.tsx` + `task-table.tsx` și stilul cardurilor din sidebar/toolbar. Sortarea/filtrarea/rolurile/acțiunile rămân neatinse.

**Tech Stack:** Next.js 14, Tailwind CSS, shadcn/ui, TanStack Table, lucide-react.

**Referință design:** `docs/plans/2026-07-26-task-manager-list-polish-design.md`

---

## Convenții & verificare

- App în `apps/task-manager/`. Verificare per task: `npm run build` verde, `npm test` verde (35).
- Ecranul e după login → verificarea vizuală finală o face utilizatorul; eu confirm prin build.
- Sentence case, două greutăți (400/500), culori din tokens (dark-mode safe). Commit după fiecare task.

---

## Task 1: Rânduri de tabel rafinate (columns + container)

**Files:**
- Modify: `apps/task-manager/src/components/tasks/columns.tsx`
- Modify: `apps/task-manager/src/components/tasks/task-table.tsx`

Context: `columns.tsx` exportă `makeColumns({ onEdit, onDelete, onFinalize, currentUserId, isAdmin })`
și are deja `STATUS_META`, `PRIORITY_META`, `initials`, `SortableHeader`, `TaskActionsMenu`-style
actions cell. Coloanele actuale: title, status (badge), priority (badge), assignee, due_date, tags, actions.

**Step 1 — Coloane noi (mai puține, mai elegante).** Rescrie array-ul din `makeColumns` la:
1. **Dungă de prioritate** — coloană `id: "priority"` (păstrează sortarea după prioritate pe header),
   dar celula randează o dungă verticală colorată:
   ```tsx
   const PRIORITY_BAR: Record<TaskPriority, string> = {
     high: "bg-red-500", medium: "bg-amber-500", low: "bg-slate-300",
   };
   // în makeColumns:
   {
     id: "priority",
     accessorFn: (t) => PRIORITY_ORDER[t.priority],
     header: ({ column }) => <SortableHeader column={column} label="" />, // sau header gol
     cell: ({ row }) => (
       <span
         aria-label={PRIORITY_META[row.original.priority].label}
         className={cn("block h-6 w-[3px] rounded-sm", PRIORITY_BAR[row.original.priority])}
       />
     ),
     size: 16,
   }
   ```
   (Header-ul poate rămâne sortabil dar cu label scurt „!" sau iconiță `Flag`; alege ce arată curat.)
2. **Sarcină** (`accessorKey: "title"`): titlu link (font-medium) + sub el chip-urile de etichete:
   ```tsx
   cell: ({ row }) => (
     <div className="space-y-1">
       <Link href={`/tasks/${row.original.id}`} className="font-medium hover:underline">
         {row.original.title}
       </Link>
       {(row.original.tags ?? []).length > 0 && (
         <div className="flex flex-wrap gap-1">
           {row.original.tags!.map((tag) => (
             <Badge key={tag.id} className="border-transparent text-white" style={{ backgroundColor: tag.color }}>
               {tag.name}
             </Badge>
           ))}
         </div>
       )}
     </div>
   )
   ```
   (Elimină coloana separată „Etichete".)
3. **Stare** — punct + etichetă (înlocuiește badge-ul plin), rămâne sortabilă:
   ```tsx
   const STATUS_DOT: Record<TaskStatus, string> = {
     todo: "bg-slate-400", in_progress: "bg-blue-500", done: "bg-green-500",
   };
   {
     accessorKey: "status",
     header: ({ column }) => <SortableHeader column={column} label="Stare" />,
     cell: ({ row }) => (
       <div className="flex items-center gap-2">
         <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[row.original.status])} />
         <span className="text-sm text-muted-foreground">{STATUS_META[row.original.status].label}</span>
       </div>
     ),
   }
   ```
4. **Responsabil** — ca acum (avatar + nume), dar avatar `h-6 w-6` și nume `text-sm text-muted-foreground`.
5. **Termen** — ca acum (sortabil, roșu dacă depășit via `isOverdue`/logica existentă).
6. **actions** — neschimbat (meniul „⋯").

Elimină coloanele vechi „priority" (badge) și „tags" separate; păstrează restul.

**Step 2 — Container & rânduri în `task-table.tsx`:**
- Wrapperul tabelului desktop: `className="overflow-hidden rounded-xl border bg-card"` (colțuri 12px,
  o singură bordură fină).
- Rânduri cu hover: adaugă pe `<TableRow>` din body `className="hover:bg-muted/50 transition-colors"`.
- Header discret: dacă e nevoie, dă `TableHead` un `text-xs text-muted-foreground font-normal`.
- Empty state: păstrează, dar `className="h-28 text-center text-muted-foreground"`.
- Spațiere confortabilă: dacă rândurile par înghesuite, adaugă `className="py-1"` pe celule sau
  crește înălțimea rândului (fără să exagerezi).

**Step 3:** `npm run build` + `npm test` → verzi.

**Step 4: Commit** `feat(task-manager): refined task table rows (priority bar, status dots)`

---

## Task 2: Carduri de statistici + toolbar coerente

**Files:**
- Modify: `apps/task-manager/src/components/tasks/task-summary.tsx`
- Modify: `apps/task-manager/src/components/tasks/assignee-breakdown.tsx`
- Modify: `apps/task-manager/src/components/tasks/tags-panel.tsx`
- Modify: `apps/task-manager/src/components/tasks/task-filters-bar.tsx`
- Modify (opțional): `apps/task-manager/src/app/page.tsx`

Context: citește fiecare fișier întâi; adaptează, nu rescrie de la zero.

**Step 1 — Metric cards (sidebar).** Uniformizează blocurile la un stil de „metric card":
- Fiecare bloc într-un container `rounded-xl border bg-card p-4` cu un titlu mic
  (`text-sm font-medium`) și conținut aerisit.
- În `task-summary.tsx`: numerele mari `text-2xl font-medium`, etichete `text-xs text-muted-foreground`,
  în grilă `grid grid-cols-3 gap-3` (sau cât are). Culori de stare consistente cu tabelul
  (punct/nuanță pentru todo/in_progress/done).
- `assignee-breakdown.tsx`: rânduri cu avatar + nume + număr aliniat la dreapta; separatoare fine.
- `tags-panel.tsx`: chip-uri de etichete cu contor; păstrează funcția de filtrare la click.

**Step 2 — Toolbar (`task-filters-bar.tsx`):** aliniere/spațiere mai bune; „Sarcină nouă" ca buton
principal (accent) la dreapta; search cu iconiță (deja are). Nu schimba logica filtrelor.

**Step 3 — Header (`page.tsx`, opțional):** spațiere consistentă (`gap`, `mb`), titlu aliniat cu
acțiunile. Nu schimba conținutul.

**Step 4:** `npm run build` + `npm test` → verzi.

**Step 5: Commit** `feat(task-manager): cohesive stat cards and toolbar polish`

---

## Task 3: Verificare finală + notă

**Files:**
- Modify (opțional): `apps/task-manager/README.md`

**Step 1:** `npm run build` + `npm test` verzi. Recapitulează pentru utilizator ce să verifice pe
ecran după deploy (dungă de prioritate, puncte de stare, hover, carduri de statistici).
**Step 2:** (Opțional) o linie în README dacă e cazul.
**Step 3: Commit** dacă s-a modificat ceva: `docs(task-manager): note list polish`

---

## Ordine & dependențe

```
1 (tabel) → 2 (sidebar/toolbar) → 3 (verificare)
```
Independente în mare; ordinea de mai sus e cea logică (tabelul e piesa centrală).

## Definition of Done

- [ ] `npm run build` fără erori; `npm test` verde (35).
- [ ] Fără regresii funcționale (sortare pe stare/termen/prioritate, filtre, quick views, acțiuni, roluri).
- [ ] Vizual (utilizator): dungă de prioritate, stare ca punct+etichetă, hover pe rânduri, carduri
      de statistici coerente, aspect general „proiectat".
- [ ] Zero schimbări de date/RLS/Server Actions.
