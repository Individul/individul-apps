# Statistici — import Excel + istoric — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adminul încarcă fișierele Excel de raportare (8 tipuri), aplicația extrage indicatorii penitenciarului **P-6**, îi păstrează în istoric și arată evoluția în timp.

**Architecture:** Model generic `stat_reports` + `stat_values`, un „cititor" per tip de raport care localizează P-6 **după text** (nu după coordonate fixe). Parsarea se face server-side cu `exceljs`; utilizatorul confirmă tipul și perioada într-o previzualizare înainte de salvare. Fișierul original se păstrează într-un bucket privat.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Storage), `exceljs` (citire), `recharts` (grafice), TypeScript, Vitest.

**Referință design:** `docs/plans/2026-07-29-statistics-import-design.md`

---

## Convenții & verificare

- App în `apps/task-manager/`. `npm test` = Vitest (`src/**/*.test.ts`), 120 teste acum.
- Verificare per task: `npm run build` + `npm test` verzi.
- **`vitest.config.ts` nu are alias `@/`** — modulele testate se importă cu căi relative.
- Fixturile de test sunt **sintetice** (structură reală, cifre inventate) — niciodată fișierele
  instituționale reale.
- Commit după fiecare task. Fără `any`.

---

## Task 1: Migrarea 0016 — tabele, bucket, RLS

**Files:**
- Create: `apps/task-manager/supabase/migrations/0016_statistics.sql`
- Modify: `apps/task-manager/supabase/README.md`

**Step 1:** Scrie migrarea:

```sql
-- Bucket privat pentru fișierele-sursă de raportare (xlsx, max 10 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'statistics', 'statistics', false, 10485760,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists stat_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'r_lunar', 'liberati', 'amnistia_2016', 'amnistia_2021',
    'gratiere', 'comisia', 'mc', 'sedinte'
  )),
  period_date date not null,
  period_type text not null check (period_type in ('saptamanal', 'lunar')),
  file_path text,
  file_name text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, period_date, period_type)
);
create index if not exists stat_reports_kind_period_idx
  on stat_reports (kind, period_date);

create table if not exists stat_values (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references stat_reports(id) on delete cascade,
  indicator text not null,
  series text not null default 'cumulat' check (series in ('cumulat', 'perioada')),
  value numeric,
  position integer not null default 0
);
create index if not exists stat_values_report_idx on stat_values (report_id);
create index if not exists stat_values_indicator_idx on stat_values (indicator);

alter table stat_reports enable row level security;
alter table stat_values enable row level security;

-- Citire: orice autentificat. Scriere: doar admin (date de raportare instituțională).
drop policy if exists "stat_reports select" on stat_reports;
create policy "stat_reports select" on stat_reports
  for select using (auth.role() = 'authenticated');
drop policy if exists "stat_reports write" on stat_reports;
create policy "stat_reports write" on stat_reports
  for all using (is_admin()) with check (is_admin());

drop policy if exists "stat_values select" on stat_values;
create policy "stat_values select" on stat_values
  for select using (auth.role() = 'authenticated');
drop policy if exists "stat_values write" on stat_values;
create policy "stat_values write" on stat_values
  for all using (is_admin()) with check (is_admin());

-- Storage: citire pentru autentificați, scriere doar admin.
drop policy if exists "statistics bucket select" on storage.objects;
create policy "statistics bucket select" on storage.objects
  for select using (bucket_id = 'statistics' and auth.role() = 'authenticated');
drop policy if exists "statistics bucket insert" on storage.objects;
create policy "statistics bucket insert" on storage.objects
  for insert with check (bucket_id = 'statistics' and is_admin());
drop policy if exists "statistics bucket delete" on storage.objects;
create policy "statistics bucket delete" on storage.objects
  for delete using (bucket_id = 'statistics' and is_admin());
```

**Step 2:** În `supabase/README.md`, secțiune nouă (stilul existent): rulează `0016_statistics.sql`
după `0015`; creează bucket-ul privat `statistics` și tabelele de statistici; scrierea e rezervată adminului.

**Step 3: Commit** `feat(task-manager): statistics schema, bucket and RLS (0016)`

---

## Task 2: Fundația cititoarelor — tipuri, registru, utilitare (TDD)

**Files:**
- Create: `apps/task-manager/src/lib/stats/types.ts`
- Create: `apps/task-manager/src/lib/stats/grid.ts`
- Create: `apps/task-manager/src/lib/stats/grid.test.ts`

Ideea: fiecare cititor primește o **grilă** (`(string|number|null)[][]`, index 0 = rândul 1) și
întoarce indicatori. Parsarea fișierului în grilă se face separat (Task 5), ca testele să nu aibă
nevoie de fișiere binare.

**Step 1: Write the failing test** — `grid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cellText, findCell, findRowStarting, composeLabel, toNumber } from "./grid";

const grid = [
  ["Titlu", null, null],
  [null, "P-5", "P-6"],
  ["Plafon", 100, 753],
  ["Penitenciarul nr. 6", 5, null],
  ["6 Soroca", 107, null],
];

describe("cellText", () => {
  it("normalizează spațiile și tratează null", () => {
    expect(cellText("  a  b ")).toBe("a b");
    expect(cellText(null)).toBe("");
    expect(cellText(7)).toBe("7");
  });
});

describe("findCell", () => {
  it("găsește celula după text exact", () => {
    expect(findCell(grid, (t) => t === "P-6")).toEqual({ row: 1, col: 2 });
  });
  it("întoarce null când nu găsește", () => {
    expect(findCell(grid, (t) => t === "P-99")).toBeNull();
  });
});

describe("findRowStarting", () => {
  it("găsește rândul după prefixul primei celule nevide", () => {
    expect(findRowStarting(grid, "Penitenciarul nr. 6")).toBe(3);
    expect(findRowStarting(grid, "6 ")).toBe(4);
    expect(findRowStarting(grid, "Penitenciarul nr. 9")).toBeNull();
  });
});

describe("composeLabel", () => {
  it("unește etichetele nevide cu ' / '", () => {
    expect(composeLabel(["Art. 12", "", "lit. a)"])).toBe("Art. 12 / lit. a)");
    expect(composeLabel(["", ""])).toBe("");
  });
});

describe("toNumber", () => {
  it("acceptă numere și șiruri numerice", () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber("12")).toBe(12);
    expect(toNumber(" 3,5 ")).toBe(3.5);
  });
  it("întoarce null pentru gol sau text", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber("")).toBeNull();
    expect(toNumber("abc")).toBeNull();
  });
});
```

**Step 2:** Run `npm test -- grid` → FAIL.

**Step 3: Implement** `src/lib/stats/types.ts`:
```ts
export type StatKind =
  | "r_lunar" | "liberati" | "amnistia_2016" | "amnistia_2021"
  | "gratiere" | "comisia" | "mc" | "sedinte";

export type StatSeries = "cumulat" | "perioada";

export interface StatItem {
  indicator: string;
  series: StatSeries;
  value: number | null;
}

/** Grilă de celule: rânduri × coloane, index 0 = rândul/coloana 1. */
export type Grid = (string | number | boolean | Date | null)[][];

export interface StatParser {
  kind: StatKind;
  label: string;               // „Raport lunar (populație)"
  /** Cât de sigur e că grila e de acest tip (0..1); cel mai mare câștigă. */
  detect(grid: Grid): number;
  parse(grid: Grid): StatItem[];
}
```

Și `src/lib/stats/grid.ts`:
```ts
import type { Grid } from "./types";

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, " ").trim();
}

export function findCell(
  grid: Grid,
  match: (text: string) => boolean,
): { row: number; col: number } | null {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (match(cellText(row[c]))) return { row: r, col: c };
    }
  }
  return null;
}

/** Indexul rândului a cărui primă celulă nevidă începe cu `prefix`. */
export function findRowStarting(grid: Grid, prefix: string): number | null {
  const want = cellText(prefix).toLowerCase();
  for (let r = 0; r < grid.length; r++) {
    const first = (grid[r] ?? []).map(cellText).find((t) => t !== "") ?? "";
    if (first.toLowerCase().startsWith(want)) return r;
  }
  return null;
}

export function composeLabel(parts: (string | null | undefined)[]): string {
  return parts.map((p) => cellText(p)).filter(Boolean).join(" / ");
}

export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = cellText(v).replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
```

**Step 4:** `npm test -- grid` → PASS; `npm test` → tot verde.

**Step 5: Commit** `feat(task-manager): statistics grid helpers with tests`

---

## Task 3: Cititoarele „pe coloane" (r_lunar, liberati, amnistia_2016, amnistia_2021) — TDD

**Files:**
- Create: `apps/task-manager/src/lib/stats/column-parsers.ts`
- Create: `apps/task-manager/src/lib/stats/column-parsers.test.ts`

Toate patru au aceeași mecanică: găsește celula cu textul `P-6` (la `amnistia_2021` tot `P-6`),
ia coloana ei, iar pentru fiecare rând sub antet compune eticheta din **coloanele dinaintea
primei coloane de penitenciar**.

**Step 1: Write the failing test** (fixturi sintetice, structura reală):

```ts
import { describe, it, expect } from "vitest";
import { columnParser } from "./column-parsers";
import type { Grid } from "./types";

// Structura din 01.06.2026_r_lunar.xlsx, cu cifre inventate.
const rLunar: Grid = [
  ["Raport săptămînal privind numărul persoanelor deţinute", null, null, null, null],
  ["(la 29 ianuarie 2018, ora 8.00)", "2026-06-30", null, null, null],
  [null, null, "P-5", "P-6", "P-7"],
  ["Plafonul de detenție", null, 170, 753, 231],
  ["Persoane deținute", null, null, 748, null],
  ["Din ei:", "Femei", null, 3, null],
  [null, "Minori", null, 0, null],
  ["Încadrați în c/m", null, null, 224, null],
];

const parser = columnParser("r_lunar", "Raport lunar (populație)", ["raport", "deţinute"]);

describe("columnParser", () => {
  it("ia doar coloana P-6", () => {
    const items = parser.parse(rLunar);
    const byName = Object.fromEntries(items.map((i) => [i.indicator, i.value]));
    expect(byName["Plafonul de detenție"]).toBe(753);
    expect(byName["Persoane deținute"]).toBe(748);
    expect(byName["Încadrați în c/m"]).toBe(224);
  });

  it("compune etichetele ierarhice", () => {
    const items = parser.parse(rLunar);
    const names = items.map((i) => i.indicator);
    expect(names).toContain("Din ei: / Femei");
    expect(names).toContain("Minori");
  });

  it("păstrează zerourile, ignoră celulele goale", () => {
    const items = parser.parse(rLunar);
    const minori = items.find((i) => i.indicator === "Minori");
    expect(minori?.value).toBe(0);
    // rândurile de titlu, fără valoare pe P-6, nu produc indicatori
    expect(items.some((i) => i.indicator.startsWith("Raport săptămînal"))).toBe(false);
  });

  it("toate valorile sunt seria „cumulat”", () => {
    expect(parser.parse(rLunar).every((i) => i.series === "cumulat")).toBe(true);
  });

  it("detect recunoaște grila după cuvintele-cheie", () => {
    expect(parser.detect(rLunar)).toBeGreaterThan(0);
    expect(parser.detect([["cu totul altceva"]])).toBe(0);
  });

  it("aruncă eroare clară dacă lipsește coloana P-6", () => {
    expect(() => parser.parse([["x"], ["y"]])).toThrow(/P-6/);
  });
});
```

**Step 2:** Run `npm test -- column-parsers` → FAIL.

**Step 3: Implement** `column-parsers.ts` — o fabrică, fiindcă toate patru diferă doar prin
cuvintele-cheie de detectare:

```ts
import { cellText, composeLabel, findCell, toNumber } from "./grid";
import type { Grid, StatItem, StatKind, StatParser } from "./types";

export function columnParser(kind: StatKind, label: string, keywords: string[]): StatParser {
  return {
    kind,
    label,
    detect(grid) {
      const hay = grid.slice(0, 8).flat().map(cellText).join(" ").toLowerCase();
      const hits = keywords.filter((k) => hay.includes(k.toLowerCase())).length;
      const hasP6 = findCell(grid, (t) => t === "P-6") !== null;
      if (!hasP6 || hits === 0) return 0;
      return hits / keywords.length;
    },
    parse(grid) {
      const head = findCell(grid, (t) => t === "P-6");
      if (!head) throw new Error("Nu am găsit coloana P-6 în fișier.");
      // Prima coloană de penitenciar din rândul de antet marchează finalul etichetelor.
      const headerRow = grid[head.row] ?? [];
      let firstPenCol = head.col;
      for (let c = 0; c < headerRow.length; c++) {
        if (/^P-\d+$/.test(cellText(headerRow[c]))) { firstPenCol = c; break; }
      }
      const items: StatItem[] = [];
      for (let r = head.row + 1; r < grid.length; r++) {
        const row = grid[r] ?? [];
        const indicator = composeLabel(row.slice(0, firstPenCol).map(cellText));
        const value = toNumber(row[head.col]);
        if (!indicator || value === null) continue;
        items.push({ indicator, series: "cumulat", value });
      }
      return items;
    },
  };
}

export const COLUMN_PARSERS: StatParser[] = [
  columnParser("r_lunar", "Raport lunar (populație penitenciară)", ["deţinute", "plafonul"]),
  columnParser("liberati", "Liberări", ["liberarea deținuților", "liberați"]),
  columnParser("amnistia_2016", "Amnistia 2016 (Legea 210/2016)", ["amnistia", "210"]),
  columnParser("amnistia_2021", "Amnistia 2021", ["comisia specială", "amnistia"]),
];
```
Notă: dacă `amnistia_2021` (care are doar coloana P-6, fără celelalte) nu se comportă bine cu
regula `firstPenCol`, tratează cazul: dacă nu există altă coloană `P-\d+`, eticheta se compune
din toate coloanele dinaintea lui P-6. Adaugă un test pentru asta.

**Step 4:** `npm test -- column-parsers` → PASS; `npm test` verde.

**Step 5: Commit** `feat(task-manager): column-layout statistics parsers with tests`

---

## Task 4: Cititoarele „pe rânduri" (gratiere, comisia, mc, sedinte) — TDD

**Files:**
- Create: `apps/task-manager/src/lib/stats/row-parsers.ts`
- Create: `apps/task-manager/src/lib/stats/row-parsers.test.ts`

Mecanica: găsește rândul penitenciarului (prefix `Penitenciarul nr. 6` sau `6 `), compune
indicatorii din **rândurile de antet** (toate rândurile dinaintea primului penitenciar, unite pe
coloană), iar dacă tipul are sub-rând, ia și rândul imediat următor ca serie `perioada`.

**Step 1: Write the failing test** (structura din `Tabel_comisia_penitenciară`, cifre inventate):

```ts
import { describe, it, expect } from "vitest";
import { rowParser } from "./row-parsers";
import type { Grid } from "./types";

const comisia: Grid = [
  ["Numărul persoanelor examinate la comisiile penitenciare (art.91, 92 CP)", null, null],
  ["Penitenciar", "Nr. persoanelor examinate", null, "Admiși"],
  [null, null, null, null],
  [null, "art. 91 CP", "art. 92 CP", "art. 91 CP"],
  ["Penitenciarul nr. 5", 1, 2, 3],
  ["Săptămînal", 0, 0, 0],
  ["Penitenciarul nr. 6", 35, 31, 2],
  ["Lunar", 4, 4, 0],
  ["Penitenciarul nr. 7", 9, 9, 9],
  ["Săptămînal", 1, 1, 1],
];

const parser = rowParser({
  kind: "comisia",
  label: "Comisia penitenciară (art. 91/92)",
  keywords: ["comisiile penitenciare"],
  rowPrefix: "Penitenciarul nr. 6",
  headerRows: 4,
  hasPeriodRow: true,
});

describe("rowParser", () => {
  it("ia rândul penitenciarului 6, nu al altora", () => {
    const items = parser.parse(comisia);
    const cumulat = items.filter((i) => i.series === "cumulat");
    expect(cumulat.map((i) => i.value)).toEqual([35, 31, 2]);
  });

  it("compune indicatorii din antetul pe mai multe rânduri", () => {
    const items = parser.parse(comisia);
    expect(items[0].indicator).toContain("art. 91 CP");
    expect(items[0].indicator).toContain("Nr. persoanelor examinate");
  });

  it("ia sub-rândul ca serie „perioada”, oricum s-ar numi", () => {
    const items = parser.parse(comisia);
    const per = items.filter((i) => i.series === "perioada");
    expect(per.map((i) => i.value)).toEqual([4, 4, 0]);
  });

  it("aruncă eroare clară dacă lipsește rândul penitenciarului", () => {
    expect(() => parser.parse([["altceva"]])).toThrow(/Penitenciarul nr. 6/);
  });

  it("detect recunoaște tipul", () => {
    expect(parser.detect(comisia)).toBeGreaterThan(0);
    expect(parser.detect([["nimic"]])).toBe(0);
  });
});
```

**Step 2:** Run `npm test -- row-parsers` → FAIL.

**Step 3: Implement** `row-parsers.ts`:

```ts
import { cellText, composeLabel, findRowStarting, toNumber } from "./grid";
import type { Grid, StatItem, StatKind, StatParser } from "./types";

export interface RowParserConfig {
  kind: StatKind;
  label: string;
  keywords: string[];
  /** Prefixul rândului P-6: „Penitenciarul nr. 6" sau „6 ". */
  rowPrefix: string;
  /** Câte rânduri de la început formează antetul (pentru numele indicatorilor). */
  headerRows: number;
  /** Are sub-rând de perioadă („Săptămînal"/„Lunar") imediat sub penitenciar? */
  hasPeriodRow: boolean;
}

export function rowParser(cfg: RowParserConfig): StatParser {
  const collect = (grid: Grid, r: number, series: "cumulat" | "perioada"): StatItem[] => {
    const row = grid[r] ?? [];
    const out: StatItem[] = [];
    for (let c = 1; c < row.length; c++) {
      const value = toNumber(row[c]);
      if (value === null) continue;
      const parts: string[] = [];
      for (let h = 0; h < cfg.headerRows; h++) parts.push(cellText((grid[h] ?? [])[c]));
      const indicator = composeLabel(parts) || `Coloana ${c + 1}`;
      out.push({ indicator, series, value });
    }
    return out;
  };

  return {
    kind: cfg.kind,
    label: cfg.label,
    detect(grid) {
      const hay = grid.slice(0, 6).flat().map(cellText).join(" ").toLowerCase();
      const hits = cfg.keywords.filter((k) => hay.includes(k.toLowerCase())).length;
      if (hits === 0 || findRowStarting(grid, cfg.rowPrefix) === null) return 0;
      return hits / cfg.keywords.length;
    },
    parse(grid) {
      const r = findRowStarting(grid, cfg.rowPrefix);
      if (r === null) throw new Error(`Nu am găsit rândul „${cfg.rowPrefix}" în fișier.`);
      const items = collect(grid, r, "cumulat");
      if (cfg.hasPeriodRow) items.push(...collect(grid, r + 1, "perioada"));
      return items;
    },
  };
}

export const ROW_PARSERS: StatParser[] = [
  rowParser({ kind: "gratiere", label: "Grațiere", keywords: ["grațiere"],
    rowPrefix: "Penitenciarul nr. 6", headerRows: 6, hasPeriodRow: false }),
  rowParser({ kind: "comisia", label: "Comisia penitenciară (art. 91/92)",
    keywords: ["comisiile penitenciare"], rowPrefix: "Penitenciarul nr. 6",
    headerRows: 4, hasPeriodRow: true }),
  rowParser({ kind: "mc", label: "Mecanism compensatoriu (art. 473/2)",
    keywords: ["mecanismul compensatoriu"], rowPrefix: "Penitenciarul nr. 6",
    headerRows: 2, hasPeriodRow: true }),
  rowParser({ kind: "sedinte", label: "Ședințe de judecată",
    keywords: ["escortare la ședințele"], rowPrefix: "6 ", headerRows: 3, hasPeriodRow: false }),
];
```
**Important:** valorile `headerRows` din listă sunt derivate din fișierele reale (vezi designul);
verifică-le rulând cititorul pe o grilă construită după structura din `docs/plans/2026-07-29-statistics-import-design.md`
și ajustează dacă etichetele ies greșit. Adaugă câte un test scurt per tip, nu doar pentru `comisia`.

**Step 4:** `npm test -- row-parsers` → PASS; `npm test` verde.

**Step 5: Commit** `feat(task-manager): row-layout statistics parsers with tests`

---

## Task 5: Citirea fișierului + detectarea tipului + perioada propusă

**Files:**
- Create: `apps/task-manager/src/lib/stats/registry.ts`
- Create: `apps/task-manager/src/lib/stats/period.ts` + `period.test.ts`
- Create: `apps/task-manager/src/lib/stats/workbook.ts` (server-only)
- Modify: `apps/task-manager/package.json` (adaugă `exceljs`)

**Step 1:** `npm install exceljs` (în `apps/task-manager`).

**Step 2:** `registry.ts` — `export const PARSERS = [...COLUMN_PARSERS, ...ROW_PARSERS];` plus
`detectKind(grid)` care întoarce parserul cu scorul cel mai mare (sau `null` sub un prag, ex. 0.5).

**Step 3 (TDD):** `period.test.ts` — `guessPeriod(fileName)` extrage data din nume:
```ts
expect(guessPeriod("01.06.2026_r_lunar.xlsx")).toEqual({ date: "2026-06-01", type: "lunar" });
expect(guessPeriod("Tabel sedinte judecată iunie 2026.xlsx")).toEqual({ date: "2026-06-01", type: "lunar" });
expect(guessPeriod("Gratierea  2026.xlsx")?.date).toBeUndefined(); // doar anul → fără propunere
```
Rulează testul (FAIL), apoi implementează `period.ts` cu două tipare: `dd.mm.yyyy` și
`<lună în română> yyyy`. Implicit `type: "lunar"`.

**Step 4:** `workbook.ts` — transformă un `ArrayBuffer` în `Grid` folosind `exceljs`:
```ts
import "server-only";
import ExcelJS from "exceljs";
import type { Grid } from "./types";

export async function readGrid(buffer: ArrayBuffer): Promise<Grid> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets.find((w) => w.rowCount > 1) ?? wb.worksheets[0];
  if (!ws) throw new Error("Fișierul nu conține nicio foaie de calcul.");
  const grid: Grid = [];
  ws.eachRow({ includeEmpty: true }, (row, r) => {
    const cells: Grid[number] = [];
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      const v = cell.value;
      // ExcelJS întoarce obiecte pentru formule/rich text — luăm rezultatul.
      cells[c - 1] =
        v && typeof v === "object" && "result" in v ? (v.result as string | number)
        : v && typeof v === "object" && "richText" in v
          ? (v.richText as { text: string }[]).map((t) => t.text).join("")
        : (v as string | number | null);
    });
    grid[r - 1] = cells;
  });
  return grid;
}
```
Atenție la celulele îmbinate: ExcelJS pune valoarea doar în ancoră; dacă etichetele ies goale,
completează pe orizontală valoarea ancorei peste celulele îmbinate (`ws.getCell(...).isMerged`).

**Step 5:** `npm test` + `npm run build` verzi. **Commit** `feat(task-manager): workbook reader, parser registry and period guess`

---

## Task 6: Server Actions + interogări

**Files:**
- Create: `apps/task-manager/src/app/statistici/actions.ts`
- Modify: `apps/task-manager/src/lib/queries.ts`
- Modify: `apps/task-manager/src/lib/types.ts`

**Step 1:** Tipuri `StatReport`, `StatValue` în `types.ts` (oglindesc coloanele din 0016).

**Step 2:** `actions.ts`:
- `previewImport(formData)` — primește fișierul, `readGrid`, `detectKind`, `guessPeriod`;
  întoarce `{ kind, kindLabel, suggestedPeriod, items, existing: boolean }` (fără să salveze nimic).
  Verifică rolul: doar admin.
- `saveImport(input)` — `{ kind, periodDate, periodType, fileName, fileBase64, items }`:
  urcă fișierul în bucket-ul `statistics`, face `upsert` pe `stat_reports`
  (`onConflict: "kind,period_date,period_type"`), **șterge** valorile vechi ale raportului și
  inserează noile `stat_values`. `revalidatePath("/statistici")`.
- `deleteReport(id)` — doar admin; șterge rândul (cascade pe valori) și obiectul din storage.
- `getReportFileUrl(path)` — link semnat 60s (ca la atașamente).

**Step 3:** `queries.ts`:
- `getStatReports()` — toate rapoartele, ordonate descrescător după `period_date` (grațios `[]`
  dacă migrarea nu e aplicată).
- `getStatSeries(kind)` — rapoartele unui tip + valorile lor, pentru grafic.

**Step 4:** `npm run build` + `npm test` verzi. **Commit** `feat(task-manager): statistics import actions and queries`

---

## Task 7: Pagina `/statistici` — import, listă, grafice

**Files:**
- Create: `apps/task-manager/src/app/statistici/page.tsx`
- Create: `apps/task-manager/src/components/stats/import-dialog.tsx`
- Create: `apps/task-manager/src/components/stats/reports-table.tsx`
- Create: `apps/task-manager/src/components/stats/series-chart.tsx`
- Modify: `apps/task-manager/src/components/layout/module-tabs.tsx`
- Modify: `apps/task-manager/package.json` (adaugă `recharts`)

**Step 1:** Adaugă tabul **Statistici** (`/statistici`) în `module-tabs.tsx`, lângă Sarcini și Petiții.

**Step 2:** `import-dialog.tsx` (doar admin): alege fișierul → `previewImport` → arată tipul
detectat (cu posibilitatea de a-l schimba dintr-un select), perioada propusă (câmp dată + select
săptămânal/lunar, ambele editabile) și **tabelul indicatorilor extrași** (indicator, serie,
valoare). Avertisment vizibil dacă perioada există deja („se va înlocui"). Buton „Importă".

**Step 3:** `reports-table.tsx`: lista rapoartelor (tip, perioadă, tip perioadă, cine a încărcat,
număr de indicatori), cu deschiderea fișierului original și ștergere — ambele doar pentru admin.
Stil identic cu listele existente (container `rounded-xl border bg-card`, rânduri `divide-y`).

**Step 4:** `series-chart.tsx` (`"use client"`): alegi tipul de raport și unul sau mai mulți
indicatori → grafic în timp (Recharts `LineChart`) + tabelul valorilor sub el.
**REQUIRED SUB-SKILL:** folosește skill-ul `dataviz` înainte de a scrie codul graficului
(culori, axe, legendă, dark mode).

**Step 5:** `page.tsx` — Server Component: `AppHeader` + titlu + butonul de import (admin) +
lista rapoartelor + secțiunea de evoluție.

**Step 6:** `npm run build` + `npm test` verzi. **Commit** `feat(task-manager): statistics page with import and charts`

---

## Task 8: Documentație + verificare finală

**Files:**
- Modify: `apps/task-manager/README.md`

**Step 1:** Secțiune „Statistici": ce face, cele 8 tipuri, fluxul de import cu previzualizare,
faptul că se extrage **doar P-6**, drepturile (import = admin), migrarea 0016 de aplicat.
**Step 2:** `npm test` + `npm run build` verzi.
**Step 3: Commit** `docs(task-manager): document statistics import`

---

## Ordine & dependențe

```
1 (migrare) → 2 (grid) → 3 (col parsers) → 4 (row parsers) → 5 (workbook+registry) → 6 (actions) → 7 (UI) → 8 (docs)
```
Task 3 și 4 depind doar de 2 și pot fi făcute în orice ordine între ele.

## Definition of Done

- [ ] `npm test` verde (peste 120 + testele noi); `npm run build` fără erori.
- [ ] Migrarea 0016 aplicată; bucket `statistics` **privat**.
- [ ] Toate cele 8 tipuri se importă din fișierele reale, cu previzualizare corectă.
- [ ] Un fișier nerecunoscut dă eroare explicită, nu import tăcut greșit.
- [ ] Istoricul arată evoluția indicatorilor în timp; fișierele originale se pot redeschide.
- [ ] Importul și ștergerea sunt rezervate adminului (RLS, nu doar UI).
