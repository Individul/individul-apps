# Task Manager — Carduri hub conștiente de rol — Design

**Data:** 2026-07-28
**Autor:** brainstorming cu Claude Code
**Context:** extindere a hub-ului de la `/` (vezi `docs/plans/2026-07-28-task-manager-hub-design.md`).

## Scop

Cardurile din hub („Sarcini" și „Petiții") să arate informația relevantă pentru rolul celui logat:

| Rol | Ce vede pe card |
|-----|-----------------|
| **Admin** | cele 4 cifre peste **tot** (Total / Active / Scadente 7 zile / Restante) **+** o listă scurtă pe persoană (avatar + nume + număr), sortată descrescător |
| **Membru** | aceleași 4 cifre, dar calculate **doar peste ce-i e atribuit** (`assignee_id = eu`); fără listă |

Descrierea cardului se adaptează: pentru membru spune explicit că sunt elementele atribuite lui.

Se aplică identic la ambele module (petițiile au deja `assignee_id`).

## Cum se calculează

- **Membru:** filtrăm lista înainte de statistici (`items.filter(i => i.assignee_id === me)`) și
  refolosim `taskStats` / `petitionStats` existente — fără modificări în ele.
- **Admin:** helper nou, pur și testat, în `src/lib/hub-stats.ts`:
  ```ts
  export interface AssigneeCount { id: string | null; name: string; count: number }
  export function countsByAssignee(
    items: { assignee_id: string | null }[],
    profiles: Profile[],
  ): AssigneeCount[]
  ```
  Reguli: grupează după `assignee_id`, rezolvă numele din `profiles` (fallback „(fără nume)"),
  sortează descrescător după `count` (la egalitate, alfabetic), iar „Neatribuit" (`id: null`)
  merge mereu la final. Elementele fără corespondent în `profiles` intră tot la „Neatribuit".

Pentru admin, defalcarea se face peste elementele **relevante** (nefinalizate / în examinare) —
altfel lista ar fi dominată de arhivă. Adică se numără aceleași elemente ca cifra „Active"
(sarcini cu `status !== "done"`) respectiv „În examinare" (petiții cu `status === "in_examinare"`).

## UI

`ModuleCard` primește un prop opțional `breakdown?: AssigneeCount[]`. Când e prezent, sub cifre
apare o listă compactă: avatar colorat (`avatarColor`, ca în restul aplicației) + nume + numărul
aliniat la dreapta. Când lipsește (membru), cardul rămâne exact ca acum — fără condiționale în pagină.

## Ce NU se schimbă

Zero migrări, zero RLS, zero drepturi de acces. Listele `/sarcini` și `/petitii` rămân neschimbate
(toți văd tot acolo, ca până acum). Doar prezentarea pe hub diferă în funcție de rol.

## Testare

- **Unit (Vitest):** `countsByAssignee` — grupare, sortare descrescătoare, tratarea „Neatribuit",
  nume lipsă, listă goală.
- **Build** verde; verificarea vizuală o face utilizatorul după deploy (ecran autentificat).

## Fișiere afectate

- Modificate: `src/lib/hub-stats.ts` (+ `hub-stats.test.ts`), `src/components/hub/module-card.tsx`,
  `src/app/page.tsx` (hub).
