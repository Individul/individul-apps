# Raportul săptămânal — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** O pagină care arată, pentru săptămâna marți→luni, cele patru cifre cerute de conducere — plecați, sosiți, teleconferințe, eliberați — și le dă ca PDF descărcabil.

**Architecture:** Săptămâna se calculează cu funcții pure, testate. Trei cifre vin din tabele existente; a patra dintr-un registru nou, minuscul. PDF-ul se generează pe server cu pdf-lib și un font inclus în proiect, fiindcă fonturile standard din PDF nu conțin diacriticele românești.

**Tech Stack:** Next.js 14 App Router, Supabase, pdf-lib + @pdf-lib/fontkit, date-fns, Vitest.

**Referință design:** `docs/plans/2026-08-01-raport-saptamanal-design.md`

---

## Convenții & verificare

- App în `apps/task-manager/`. `npm test` = Vitest (**454 teste** acum).
- **Fără alias `@/` în vitest** — modulele testate se importă relativ.
- Verificare per task: `npm run build`, `npm run lint`, `npm test` verzi.
- Comentariile explică **de ce**, în română. Fără `any`.
- Datele AAAA-LL-ZZ trec prin `parseISODate`/`toISODate` din `lib/periods`.
  **Niciodată `new Date("2026-08-04")`** — a produs deja un off-by-one aici.

---

## Task 1: Săptămâna raportului (TDD)

**Files:**
- Create: `apps/task-manager/src/lib/weekly-report.ts`
- Create: `apps/task-manager/src/lib/weekly-report.test.ts`

### Step 1: Testele (RED)

```ts
import { describe, expect, it } from "vitest";
import { reportWeek, shiftWeek } from "./weekly-report";
import { toISODate } from "./periods";

const iso = (r: { from: Date; to: Date }) => [toISODate(r.from), toISODate(r.to)];

describe("săptămâna raportului", () => {
  it("marți arată săptămâna tocmai încheiată, nu ziua curentă", () => {
    // 4 august 2026 e marți. Raportul de azi acoperă 28 iulie → 3 august.
    // Marțea curentă intră în raportul de săptămâna viitoare.
    expect(iso(reportWeek(new Date(2026, 7, 4)))).toEqual(["2026-07-28", "2026-08-03"]);
  });

  it("miercuri arată aceeași săptămână ca marți", () => {
    // Raportul nu se schimbă sub mână în cursul săptămânii.
    expect(iso(reportWeek(new Date(2026, 7, 5)))).toEqual(["2026-07-28", "2026-08-03"]);
  });

  it("luni arată tot săptămâna de dinainte: ziua de azi nu s-a încheiat", () => {
    // 10 august e luni. Săptămâna 4→10 august nu e completă până la miezul
    // nopții, deci raportul rămâne pe cea dinainte.
    expect(iso(reportWeek(new Date(2026, 7, 10)))).toEqual(["2026-07-28", "2026-08-03"]);
  });

  it("marțea următoare avansează exact cu șapte zile", () => {
    expect(iso(reportWeek(new Date(2026, 7, 11)))).toEqual(["2026-08-04", "2026-08-10"]);
  });

  it("intervalul are întotdeauna șapte zile", () => {
    for (let d = 1; d <= 31; d++) {
      const w = reportWeek(new Date(2026, 6, d));
      const zile = Math.round((w.to.getTime() - w.from.getTime()) / 86_400_000) + 1;
      expect(zile).toBe(7);
    }
  });

  it("începe marți și se termină luni, în orice zi ai deschide", () => {
    for (let d = 1; d <= 31; d++) {
      const w = reportWeek(new Date(2026, 6, d));
      expect(w.from.getDay()).toBe(2); // marți
      expect(w.to.getDay()).toBe(1); // luni
    }
  });

  it("navigarea nu sare și nu suprapune", () => {
    const acum = reportWeek(new Date(2026, 7, 4));
    const inainte = shiftWeek(acum, -1);
    expect(iso(inainte)).toEqual(["2026-07-21", "2026-07-27"]);
    // Ziua de după sfârșitul săptămânii precedente e chiar începutul celei de acum.
    expect(toISODate(acum.from)).toBe("2026-07-28");
    expect(iso(shiftWeek(inainte, 1))).toEqual(iso(acum));
  });

  it("trece peste marginea de an fără să se rupă", () => {
    const w = reportWeek(new Date(2027, 0, 5)); // 5 ian 2027, marți
    expect(iso(w)).toEqual(["2026-12-29", "2027-01-04"]);
  });
});
```

### Step 2: Rulează, confirmă RED.

`npm test -- weekly-report` → „Cannot find module './weekly-report'".

### Step 3: Implementează

```ts
import { addDays, startOfDay } from "date-fns";
import type { DateRange } from "./periods";

/**
 * Săptămâna pe care o acoperă raportul: marțea trecută → luni, inclusiv.
 *
 * Marțea în care se prezintă raportul intră în săptămâna URMĂTOARE. Altfel
 * aceeași marți ar apărea în două rapoarte consecutive, iar un transfer de
 * marți s-ar număra de două ori. În plus, dimineața raportului n-ar mai
 * depinde de date care abia se întâmplă.
 *
 * Deschis luni, arată tot săptămâna de dinainte: ziua curentă nu s-a încheiat.
 */
export function reportWeek(today: Date = new Date()): DateRange {
  const t = startOfDay(today);
  // Câte zile de la ultima marți (0 dacă azi e marți). getDay(): 0=duminică.
  const deLaMarti = (t.getDay() - 2 + 7) % 7;
  const martiCurenta = addDays(t, -deLaMarti);
  // Marțea curentă aparține săptămânii care abia începe, deci se ia cea dinainte.
  const from = addDays(martiCurenta, -7);
  return { from, to: addDays(from, 6) };
}

/** Săptămâna vecină, pentru navigarea înapoi/înainte. */
export function shiftWeek(week: DateRange, weeks: number): DateRange {
  return { from: addDays(week.from, weeks * 7), to: addDays(week.to, weeks * 7) };
}
```

### Step 4: GREEN — `npm test`, `npm run build`, `npm run lint`.
### Step 5: Commit `feat(raport): săptămâna marți→luni (TDD)`

---

## Task 2: Migrarea 0026 — registrul eliberărilor

**Files:**
- Create: `apps/task-manager/supabase/migrations/0026_releases.sql`
- Modify: `apps/task-manager/src/lib/types.ts` (`"releases"` în `AuditEntry["entity"]`)
- Modify: `apps/task-manager/src/lib/backup-dump.ts` (tabelul în `BACKUP_TABLES`)
- Modify: `apps/task-manager/src/lib/audit-modules.ts` (entitatea într-un modul)

```sql
-- Eliberările, ca să nu mai fie singura cifră din raportul săptămânal care se
-- ține minte. Un rând pe zi: ziua și câți. Atât — orice coloană în plus ar fi
-- un câmp de completat săptămânal, pentru o cifră pe care n-o cere nimeni.

create table if not exists releases (
  id uuid primary key default gen_random_uuid(),
  release_date date not null unique,
  count integer not null default 0 check (count >= 0),
  note text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists releases_date_idx on releases (release_date desc);

drop trigger if exists releases_updated_at on releases;
create trigger releases_updated_at before update on releases
  for each row execute function set_updated_at();

alter table releases enable row level security;

-- Registru comun al secției, ca la ședințe: oricine autentificat citește și
-- completează, altfel un coleg n-ar putea corecta ziua introdusă de altul.
-- Ștergerea e a adminului. Cine a scris rămâne în jurnal.
drop policy if exists "releases select" on releases;
create policy "releases select" on releases
  for select using (auth.role() = 'authenticated');

drop policy if exists "releases insert" on releases;
create policy "releases insert" on releases
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "releases update" on releases;
create policy "releases update" on releases
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "releases delete" on releases;
create policy "releases delete" on releases
  for delete using (is_admin());
```

**Auditul: trigger propriu, nu ramură în `record_audit()`.** Migrările 0021, 0023
și 0025 au trecut la tiparul ăsta — o funcție mică per tabel — tocmai fiindcă
rescrierea funcției comune riscă să piardă ramurile celorlalte module. Copiază
structura din `0025_defendants.sql:71-106` și adapteaz-o.

**Trei liste trebuie actualizate**, altfel tabelul iese din copia de siguranță și
din jurnal:
1. `AuditEntry["entity"]` — adaugă `| "releases"`;
2. `BACKUP_TABLES` — `{ name: "releases", order: ["release_date", "id"] }`;
3. `AUDIT_MODULES` — entitatea într-un modul (`sedinte` e cel mai apropiat, sau
   unul nou).

Compilarea și testul derivat din migrări te vor obliga oricum: `backup-dump.test.ts`
citește tabelele din `supabase/migrations/` și cade dacă `releases` lipsește din
listă. **Rulează testele ca să vezi asta întâmplându-se** — e garda pusă exact
pentru cazul ăsta.

Verifică: `npm run build`, `npm test`.
Commit: `feat(raport): migrarea 0026 (registrul eliberărilor)`

---

## Task 3: Cifrele raportului

**Files:**
- Modify: `apps/task-manager/src/lib/queries.ts` (`getReleases`)
- Modify: `apps/task-manager/src/lib/types.ts` (interfața `Release`)
- Create: `apps/task-manager/src/app/raport-saptamanal/actions.ts`

`getReleases(from, to)` pe tiparul lui `getHearings` (`queries.ts`), inclusiv
întoarcerea grațioasă a listei goale dacă migrarea nu e aplicată.

Server Action `saveRelease(date, count, note)` — upsert pe `release_date`, cu
`.select()` și **garda pe zero rânduri**; vezi `transferuri/actions.ts:119-131`
pentru tipar și pentru comentariul care explică de ce.

Cele patru cifre, în componenta paginii:
- **Plecați / Sosiți** — `getTransfers()`, filtrate pe interval, prin `aggregate`
  din `lib/transfers`.
- **Teleconferințe** — `getHearings(from, to)`, sumă pe `tc_total`. Coloana e
  generată în Postgres (`tc_petrecute + tc_amanate`), deci **nu o recalcula**.
  Amânatele se adună separat, pentru rândul mic de dedesubt.
- **Eliberați** — sumă pe `count` din `getReleases`.

Verifică: `npm run build`, `npm run lint`, `npm test`.
Commit: `feat(raport): interogări și acțiuni pentru cifrele săptămânii`

---

## Task 4: Pagina

**Files:**
- Create: `apps/task-manager/src/app/raport-saptamanal/page.tsx`
- Create: `apps/task-manager/src/components/weekly/report-view.tsx`
- Create: `apps/task-manager/src/components/weekly/release-entry.tsx`

Citește întâi `src/app/sedinte/raport/page.tsx` — pagina asta e sora ei.

1. Antet: **„Date statistice"** plus perioada (`rangeLabelRo`).
2. Cele patru cifre mari. Amânatele, mic, sub teleconferințe.
3. **Avertizare** dacă `missingWorkdays(range, hearings)` întoarce ceva, cu link
   spre `/sedinte`. Înainte de butoane, nu după: un raport tipărit cu o cifră
   incompletă nu se mai poate retrage.
4. Zona de eliberări (`release-entry.tsx`), cu clasa **`no-print`** — definită în
   `globals.css`.
5. Navigare ← / → între săptămâni, prin `shiftWeek`, cu săptămâna în URL.
6. Butoane: **„Descarcă PDF"** (link către ruta din Task 5) și **„Tipărește"**.

`export const dynamic = "force-dynamic";`

Verifică: `npm run build`, `npm run lint`, `npm test`.
Commit: `feat(raport): pagina raportului săptămânal`

---

## Task 5: PDF-ul

**Files:**
- Create: `apps/task-manager/src/app/raport-saptamanal/pdf/route.ts`
- Adaugă: fontul în `apps/task-manager/public/fonts/`
- Modify: `package.json` (`pdf-lib`, `@pdf-lib/fontkit`)

### Diacriticele — citește asta înainte de orice

**Fonturile standard din PDF nu conțin ș, ț și ă.** Codificarea lor acoperă î și â,
dar nu literele din Latin Extended. Fiecare cuvânt din raport — „Ședințe",
„Plecați", „Sosiți", „Eliberați" — ar ieși cu semne greșite sau goluri.

Deci: **descarcă un font cu acoperire românească** (Noto Sans sau DejaVu Sans,
licență liberă), pune-l în `public/fonts/`, și include-l cu `@pdf-lib/fontkit`:

```ts
import fontkit from "@pdf-lib/fontkit";
const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
const font = await pdf.embedFont(await readFile(fontPath));
```

Fontul se citește de pe disc (`node:fs/promises` + `process.cwd()`), nu prin
`fetch` la propriul site.

**Verifică ș și ț cu ochii, în fișierul generat.** Un PDF în care scrie „Sedinte"
în loc de „Ședințe" trece orice test automat și cade la prima privire a conducerii.

### Restul rutei

- `GET` cu săptămâna în parametri; validează, iar la lipsă folosește `reportWeek()`.
- Aceleași cifre ca pagina — **importate din același loc**, nu recalculate. Două
  socoteli pentru aceeași cifră au produs deja aici „8 restanțe într-un loc, 1 în
  altul".
- Aceeași structură: antet „Date statistice", perioada, cele patru cifre,
  amânatele mic, subsol cu întocmitorul și **ora Chișinăului** —
  `Intl.DateTimeFormat("ro-RO", { timeZone: "Europe/Chisinau" })`, ca în
  `sedinte/raport/page.tsx`. Ceasul serverului e UTC.
- Antete: `Content-Type: application/pdf` și
  `Content-Disposition: attachment; filename="raport-AAAA-LL-ZZ.pdf"`.
- Ruta cere **sesiune** — middleware-ul o acoperă deja; **nu** o adăuga la
  excepțiile publice (acolo e doar `/api/backup`, care se apără cu secret).

Verifică: `npm run build`, `npm run lint`, plus **generarea și deschiderea unui PDF
real**.
Commit: `feat(raport): generare PDF cu diacritice corecte`

---

## Task 6: Butonul și documentația

**Files:**
- Modify: `apps/task-manager/src/app/page.tsx`
- Modify: `apps/task-manager/README.md`

Buton discret lângă titlul de pe pagina de start: **„Raportul de marți"**. Nu în
tab-urile de module — nu e un modul, e o hârtie săptămânală.

README, secțiune nouă: ce conține raportul, de ce săptămâna e marți→luni, de ce
teleconferințele sunt petrecute+amânate, **de ce există un font în repo**, și că
migrarea `0026` trebuie rulată.

Verifică tot: `npm test`, `npm run build`, `npm run lint`.
Commit: `docs(raport): butonul de pe pagina de start și documentația`

---

## Ordine & dependențe

```
1 (săptămâna) → 3 (cifre) → 4 (pagina) → 5 (PDF) → 6 (buton, docs)
2 (migrarea)  ↗
```

## Definition of Done

- [ ] `npm test`, `npm run build`, `npm run lint` verzi; testele au trecut de 454.
- [ ] Deschis marți, raportul arată săptămâna încheiată; deschis luni, tot pe ea.
- [ ] Teleconferințele sunt petrecute + amânate, citite din `tc_total`.
- [ ] Zilele lucrătoare fără date se semnalează **înainte** de butoanele de export.
- [ ] PDF-ul a fost deschis și **ș, ț, ă se văd corect**.
- [ ] Cifrele din PDF și cele de pe pagină ies din aceeași funcție.
- [ ] `releases` intră în copia de siguranță și în jurnalul de audit.
- [ ] Utilizatorul știe că trebuie să ruleze `0026_releases.sql`.
