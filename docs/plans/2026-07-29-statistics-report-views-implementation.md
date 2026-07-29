# Statistici — grafice pe raport — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `/statistici` devine o pagină cu o secțiune per raport, fiecare cu graficele potrivite conținutului lui, în locul uneltei generice de bifat indicatori.

**Architecture:** O configurație declarativă per tip de raport (ce cifre mari, ce grafice, ce serii) + componente de grafic reutilizabile. Potrivirea indicatorilor se face pe nume normalizat, prin prefix, tolerant la lipsă. Importul și cititoarele rămân neatinse.

**Tech Stack:** Next.js 14, Recharts (deja instalat), TypeScript, Tailwind + shadcn, Vitest.

**Referință design:** `docs/plans/2026-07-29-statistics-report-views-design.md`

---

## Convenții & verificare

- App în `apps/task-manager/`. `npm test` = Vitest (202 teste acum). **Fără alias `@/` în vitest.**
- Verificare per task: `npm run build`, `npm run lint`, `npm test` verzi.
- **REQUIRED SUB-SKILL pentru orice cod de grafic: `dataviz`.** Regulile ei (o singură axă,
  culoare pe entitate în ordine fixă, mărci subțiri, text în cerneala de UI) nu se negociază.
- Commit după fiecare task. Fără `any`.

---

## Task 1: Configurația vizualizărilor + potrivirea indicatorilor (TDD)

**Files:**
- Create: `apps/task-manager/src/lib/stats/report-views.ts`
- Create: `apps/task-manager/src/lib/stats/report-views.test.ts`

### Step 0 — află numele REALE ale indicatorilor

Nu ghici etichetele. Rulează cititoarele pe fișierele reale ale utilizatorului și notează
numele exacte:

Fișiere: `C:\Users\prisa\Downloads\2.Darea de seamă 30.06.2026\2.Darea de seamă 30.06.2026\`
Harness: agenții anteriori au folosit un script în scratchpad
(`C:\Users\prisa\AppData\Local\Temp\claude\C--Users-prisa-individul-apps\192128f2-4f49-4e24-ad36-3660bf04fb59\scratchpad`)
care bundluiește sursa TS cu esbuild și rulează `readGrid` → `detectParser` → `parse`.
Refolosește-l sau scrie unul echivalent. **Niciun fișier real nu intră în repo.**

Notează, pentru fiecare din cele 8 tipuri, lista completă de `indicator` + `series` + valoare.
Configurația de mai jos se scrie **contra acestor nume**.

### Step 1 — testele (RED)

`report-views.test.ts` acoperă:
```ts
import { findValue, pickCategoricalForm, REPORT_VIEWS, viewFor } from "./report-views";
```
- `findValue(values, "Persoane deținute")` întoarce valoarea, comparând normalizat:
  potrivește și când numele real are diacritice/spații diferite („Persoane  deţinute").
- potrivire **prin prefix**: `findValue(values, "Art. 473/2")` găsește
  „Art. 473/2 alin. (3) CPP (compensat, condiții de detenție)".
- indicator inexistent → `null` (NU 0).
- respectă `series`: același nume cu `cumulat` și `perioada` sunt valori diferite.
- `pickCategoricalForm(n)` → `"donut"` pentru n ≤ 6, `"bars"` pentru n ≥ 7.
- `viewFor(kind)` întoarce o configurație pentru fiecare din cele 8 tipuri (niciunul fără).

### Step 2 — rulează, confirmă RED.

### Step 3 — implementează

```ts
import type { StatSeries } from "./types";

export interface ValueRef { indicator: string; series?: StatSeries; label: string }
export interface TileSpec extends ValueRef { tone?: "default" | "good" | "bad" }
export interface ChartSpec {
  title: string;
  kind: "line" | "categorical" | "grouped";
  /** line: serii în timp. categorical: felii/bare dintr-o perioadă. grouped: grupuri × serii. */
  series: ValueRef[];
  /** line: linie punctată de referință (ex. plafonul). */
  reference?: ValueRef;
  /** grouped: numele grupurilor, în ordinea din `series` (ex. Examinați/Admiși/Refuzați). */
  groups?: string[];
}
export interface ReportView { title: string; tiles: TileSpec[]; charts: ChartSpec[] }

export function normalizeIndicator(s: string): string   // fără diacritice, lowercase, spații colapsate
export function findValue(
  values: { indicator: string; series: StatSeries; value: number | null }[],
  ref: ValueRef | string,
): number | null
export function pickCategoricalForm(count: number): "donut" | "bars"
export function viewFor(kind: StatKind): ReportView
export const REPORT_VIEWS: Record<StatKind, ReportView>
```

Configurațiile (scrise contra numelor reale din Step 0), în spiritul mockup-ului aprobat:

- **`r_lunar` — „Populație penitenciară"**
  - cifre: Deținuți (`Persoane deținute`), Plafon (`Plafonul de detenție`), și a treia derivată din
    `Suprapopularea`: dacă valoarea e > 0 → eticheta „Suprapopulare", ton `bad`; dacă e ≤ 0 →
    eticheta „Locuri libere" cu valoarea absolută, ton `good`. (Da, e o regulă de afișare —
    documenteaz-o în cod: -5 înseamnă 5 locuri libere.)
  - grafic linie: `Persoane deținute` în timp, cu `Plafonul de detenție` ca referință punctată.
- **`liberati` — „Liberări"**
  - cifră: Total (`Total liberați deținuți`).
  - grafic categorial: motivele de liberare (toate rândurile de motiv, nu totalurile) —
    `pickCategoricalForm` alege inel sau bare după câte rămân nenule.
  - grafic linie: `Total liberați deținuți` în timp.
- **`comisia` — „Comisia penitenciară"**: bare grupate — grupuri Examinați / Admiși / Refuzați,
  serii art. 91 și art. 92.
- **`gratiere` — „Grațiere"**: bare — demersuri parvenite, examinate, grațiați, refuzați.
- **`sedinte` — „Ședințe de judecată"**: bare grupate — teleconferință vs. instanță
  (total ședințe, prezenți, amânate).
- **`mc` — „Mecanism compensatoriu"**: linie în timp pentru cele 3 valori.
- **`amnistia_2016`, `amnistia_2021`**: bare orizontale pe articole (etichete lungi).

**Excludeți din grafice totalurile** când desenați o compoziție — altfel „Total" apare ca felie
lângă părțile lui. Documentează asta.

### Step 4 — GREEN; `npm test` + `npm run build`.
### Step 5 — Commit `feat(task-manager): per-report chart configuration with tests`

---

## Task 2: Componentele de grafic

**Files:**
- Create: `apps/task-manager/src/components/stats/charts/line-chart.tsx`
- Create: `apps/task-manager/src/components/stats/charts/categorical-chart.tsx`
- Create: `apps/task-manager/src/components/stats/charts/grouped-bar-chart.tsx`
- Modify (dacă e nevoie): `apps/task-manager/src/app/globals.css` (variabilele `--chart-*` există deja)

**REQUIRED SUB-SKILL: `dataviz`** — citește-o înainte de a scrie cod de grafic.

Toate `"use client"`, pe Recharts, cu paleta categorială în ordinea fixă deja folosită în
`series-chart.tsx` (slot 1 albastru, 2 portocaliu, 3 aqua, …). Cerințe comune:
- mărci subțiri (linie 2px, bare ≤24px cu capăt rotunjit 4px), grilă orizontală discretă,
  axe recesive, text în `muted-foreground` — niciodată în culoarea seriei;
- legendă pentru ≥2 serii, cu valoarea alături la graficele categoriale;
- tooltip la hover; valorile lipsă rămân lipsă (`connectNulls={false}`), niciodată 0 inventat;
- `line-chart` acceptă o serie de referință punctată gri (plafonul);
- `categorical-chart` primește `form: "donut" | "bars"` și randează inel (cu gaură 58%) sau
  bare orizontale, cu etichete complete lângă bare;
- fără a doua axă, niciodată.

Verifică `npm run build` + `npm run lint`.
Commit: `feat(task-manager): chart components for statistics`

---

## Task 3: Pagina cu secțiuni per raport

**Files:**
- Create: `apps/task-manager/src/components/stats/report-section.tsx`
- Modify: `apps/task-manager/src/app/statistici/page.tsx`
- Delete: `apps/task-manager/src/components/stats/series-chart.tsx` (unealta generică)

`report-section.tsx` (`"use client"`) primește `{ kind, view, periods }` (periods din
`listSeries(kind)`, deja existent) și randează:
1. titlul secțiunii (din `view.title`) + perioada ultimului raport;
2. cifrele mari (`view.tiles`) din **ultima** perioadă — folosind `findValue`;
3. graficele din `view.charts`;
4. „Toate valorile" — un `<details>` închis implicit, cu tabelul complet al ultimei perioade
   (indicator, serie în limbaj normal, valoare). **Nu ascunde date**: ce nu intră în grafice se
   vede aici.
Dacă `periods` e gol → o singură linie discretă „Niciun raport importat.".
Dacă există o singură perioadă, graficele în timp se înlocuiesc cu o notă („Un grafic în timp are
nevoie de cel puțin două perioade"); cele categoriale se desenează normal.

`page.tsx`: încarcă în paralel seriile pentru toate cele 8 tipuri și randează câte o
`ReportSection` pentru fiecare, în ordinea din `REPORT_VIEWS`. Păstrează `AppHeader`, titlul,
butonul de import (admin) și tabelul rapoartelor importate — **mută-l la finalul paginii**, sub
secțiuni: e evidența fișierelor, nu conținutul principal.

Verifică `npm run build` + `npm run lint` + `npm test`.
Commit: `feat(task-manager): per-report sections on statistics page`

---

## Task 4: Limbajul ferestrei de import

**Files:**
- Modify: `apps/task-manager/src/components/stats/import-dialog.tsx`
- Modify (dacă e nevoie): `apps/task-manager/src/lib/stats/labels.ts`

Fără schimbări de logică — doar prezentare:
- Confirmarea, într-o singură frază: „Am recunoscut: **Raport lunar**, perioada **30 iunie 2026**.
  E corect?" (tipul și data rămân editabile dedesubt, ca acum).
- **Scorul de potrivire dispare.** Rămâne doar „recunoscut automat" / „ales manual".
- Tabelul valorilor extrase devine `<details>` **închis implicit**, cu rezumat
  „Vezi cele N valori extrase".
- Jargonul: „indicatori" → „valori extrase"; seria `cumulat` → „de la începutul anului";
  `perioada` → „în perioadă". Actualizează `SERIES_LABEL` dacă acolo stau etichetele.
- Butonul principal: „Importă".

Verifică `npm run build` + `npm run lint` + `npm test`.
Commit: `feat(task-manager): plain-language statistics import dialog`

---

## Task 5: Documentație

**Files:** `apps/task-manager/README.md` — actualizează secțiunea „Statistici": pagina are acum
o secțiune per raport, cu graficele potrivite; tabelul „Toate valorile" păstrează accesul la tot.

Commit: `docs(task-manager): update statistics section`

---

## Ordine & dependențe

```
1 (config TDD) → 2 (componente grafic) → 3 (pagina) → 4 (import) → 5 (docs)
```
Task 4 e independent de 1-3 și poate fi făcut oricând.

## Definition of Done

- [ ] `npm test`, `npm run build`, `npm run lint` verzi.
- [ ] Fiecare din cele 8 rapoarte are secțiunea lui, cu graficele potrivite conținutului.
- [ ] Nicio dată nu e ascunsă: „Toate valorile" arată tot ce s-a importat pentru perioadă.
- [ ] Valorile lipsă rămân lipsă; niciun 0 inventat; nicio a doua axă.
- [ ] Importul vorbește în limbaj normal, fără scor de potrivire și fără „serie cumulat".
- [ ] Importul, cititoarele, migrarea și drepturile rămân neschimbate.
