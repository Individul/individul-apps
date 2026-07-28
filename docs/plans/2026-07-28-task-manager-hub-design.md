# Task Manager — Hub + navigație între module — Design

**Data:** 2026-07-28
**Autor:** brainstorming cu Claude Code
**Context:** `apps/task-manager` are acum două module: **Sarcini** și **Petiții** (`/petitii`).
Navigația e ad-hoc (un buton „Petiții" pe pagina de sarcini, un link „← Sarcini" pe petiții),
iar antetul e duplicat în ambele pagini.

## Scop

Navigație clară și rapidă între module, plus o pagină „acasă" cu privire de ansamblu.

## Decizii (din brainstorming)

| Întrebare | Decizie |
|-----------|---------|
| Cine folosește modulele | Aceleași persoane, comută des → bară de navigare **permanentă** |
| Aterizare după login | **Hub-dashboard** cu carduri (ideea utilizatorului), îmbogățit cu cifre live |
| Structură URL | „Curată": `/` = hub, `/sarcini` = listă sarcini, `/petitii` = petiții |

## 1. Shell comun (antet unic)

Astăzi `page.tsx` și `petitii/page.tsx` își construiesc fiecare antetul (Profil, Parolă,
Deconectare — iar Petiții n-are clopoțel). Introducem un **layout comun** pentru zona
autentificată, cu antet unic:

- **stânga:** „Acasă" (→ `/`) + tab-uri **Sarcini | Petiții**, cu evidențierea celui activ
  (component client care citește `usePathname()`).
- **dreapta:** clopoțelul de notificări, „Administrare" (doar admin), „Profilul meu",
  „Schimbă parola", „Deconectare".

Antetul se randează o singură dată → dispare duplicarea, iar Petiții primește automat clopoțelul.

Implementare: `src/app/(app)/layout.tsx` (route group, fără impact pe URL) sau un component
`<AppHeader>` folosit de fiecare pagină. **Preferat: route group** — un singur loc care încarcă
profilul + notificările.

## 2. Hub la `/`

Server Component cu două carduri mari, clickabile integral, cu **cifre live**:

- **Sarcini** — total, active (nefinalizate), scadente în 7 zile, restante.
- **Petiții** — total, în examinare, cu termen apropiat/depășit.

Datele vin din interogările existente (`getTasks`, `getPetitions`); cifrele se calculează
printr-un helper pur, testabil (`hubStats`), nu în JSX. Cardurile arată și o descriere scurtă
și un buton „Deschide".

## 3. Rutare

| Rută | Ce e |
|------|------|
| `/` | hub (aterizare după login — login-ul deja redirecționează la `/`) |
| `/sarcini` | lista de sarcini (mutată de la `/`) |
| `/petitii` | petiții (neschimbat) |
| `/tasks/[id]` | detaliu sarcină (neschimbat) |
| `/tasks` | redirect → `/sarcini` (era redirect → `/`) |
| `/admin`, `/admin/backup` | neschimbate |

**De actualizat la mutare** (inventar făcut):
- 15 apeluri `revalidatePath("/")` → `/sarcini` acolo unde se referă la lista de sarcini
  (`tasks/actions.ts`, `notifications/actions.ts`, `account/actions.ts`, `admin/actions.ts`);
  unde e relevant se poate revalida și `/` (hub-ul afișează cifre).
- Linkuri „înapoi": `tasks/[id]/page.tsx` și `admin/page.tsx` → `/sarcini`;
  `petitii/page.tsx` scapă de link-ul ad-hoc (are tab-uri).
- `admin/page.tsx`: `redirect("/")` pentru non-admini rămâne valid (hub).

## 4. Fără schimbări de date

Zero migrări, zero modificări de RLS/Server Actions (doar căile din `revalidatePath`).
Notificările continuă să lege la `/tasks/[id]`.

## 5. Testare

- **Unit (Vitest):** helper-ul `hubStats(tasks, petitions)` — cifre corecte (active, scadente
  7 zile, restante, în examinare), inclusiv liste goale.
- **Build** verde; verificarea vizuală o face utilizatorul după deploy (ecran autentificat).

## Alternative respinse

- **Doar hub, fără bară** — ocol la fiecare comutare; utilizatorii comută des.
- **Doar bară, fără hub** — rapid, dar fără privire de ansamblu; utilizatorul a vrut hub-ul.
- **Hub la `/panou`, lista rămâne la `/`** — mai puțin de refactorizat, dar URL-uri asimetrice
  care se strică mai rău la al treilea modul.

## Fișiere afectate (estimare)

- Nou: `src/app/(app)/layout.tsx` + `src/components/layout/app-header.tsx` (+ tab-uri client),
  `src/app/page.tsx` (hub), `src/lib/hub-stats.ts` + test.
- Mutat: `src/app/page.tsx` (listă) → `src/app/sarcini/page.tsx`.
- Modificate: `tasks/actions.ts`, `notifications/actions.ts`, `account/actions.ts`,
  `admin/actions.ts` (căi revalidate), `tasks/page.tsx` (redirect), `tasks/[id]/page.tsx`,
  `admin/page.tsx`, `petitii/page.tsx` (scot antetul propriu).
