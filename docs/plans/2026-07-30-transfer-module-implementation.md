# Modulul Transfer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** O pagină `/transferuri` care ține evidența persoanelor transferate din și în Penitenciarul nr. 6, în cifre agregate, și care știe singură zilele de transfer programat.

**Architecture:** Un tabel `transfers` — un rând per zi + instituție + tip, cu plecați și sosiți în același rând. Logica zilelor programate și a agregării stă în funcții pure, testate, fără bază de date. Utilitarele de perioadă se mută din `hearings.ts` într-un modul comun.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), TypeScript strict, Tailwind + shadcn/ui, date-fns, Vitest.

**Referință design:** `docs/plans/2026-07-30-transfer-module-design.md`

---

## Convenții & verificare

- App în `apps/task-manager/`. `npm test` = Vitest (295 teste acum).
- **Fără alias `@/` în vitest** — modulele testate se importă relativ (`./transfers`).
- Verificare per task: `npm run build`, `npm run lint`, `npm test` verzi.
- Commit după fiecare task. Fără `any`.
- Comentariile explică **de ce**, nu ce — ca în restul codului, în română.

---

## Task 1: Migrarea 0020_transfers.sql

**Files:**
- Create: `apps/task-manager/supabase/migrations/0020_transfers.sql`
- Modify: `apps/task-manager/src/lib/types.ts:55-64` (adaugă `"transfers"` la `AuditEntry["entity"]`)

**Step 1: Scrie migrarea**

```sql
-- Evidența transferurilor: un rând per zi + penitenciar + tip, cu plecările și
-- sosirile în același rând. Se înregistrează cifre, nu persoane — vezi designul
-- pentru consecința asta (din totaluri nu se poate reveni la nume).

create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_date date not null,

  -- Numărul penitenciarului partener, nu text liber: nimeni nu poate scrie
  -- „Penit. 3" într-o zi și „P-3" în alta. Eticheta se compune în cod.
  -- Excluderile spun două lucruri deodată: nr. 6 suntem noi (nu te transferi
  -- la tine însuți), iar nr. 14 nu există.
  institution smallint not null
    check (institution between 1 and 18 and institution not in (6, 14)),

  kind text not null default 'planificat' check (kind in ('planificat', 'urgent')),

  plecati integer not null default 0 check (plecati >= 0),
  sositi integer not null default 0 check (sositi >= 0),
  total integer generated always as (plecati + sositi) stored,

  note text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- `kind` intră în cheie: într-o zi programată poate apărea și o mișcare
  -- urgentă cu aceeași instituție, iar cele două rămân rânduri distincte.
  unique (transfer_date, institution, kind)
);

create index if not exists transfers_date_idx on transfers (transfer_date desc);

drop trigger if exists transfers_updated_at on transfers;
create trigger transfers_updated_at before update on transfers
  for each row execute function set_updated_at();

alter table transfers enable row level security;

-- Registru comun al secției, ca la ședințe: oricine autentificat citește și
-- completează — altfel un coleg n-ar putea corecta ziua introdusă de altul.
-- Ștergerea e doar a adminului. Cine a scris rămâne în jurnalul de audit.
drop policy if exists "transfers select" on transfers;
create policy "transfers select" on transfers
  for select using (auth.role() = 'authenticated');

drop policy if exists "transfers insert" on transfers;
create policy "transfers insert" on transfers
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "transfers update" on transfers;
create policy "transfers update" on transfers
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "transfers delete" on transfers;
create policy "transfers delete" on transfers
  for delete using (is_admin());
```

**Step 2: Extinde `record_audit()`**

Copiază funcția întreagă din `0018_hearings.sql` (liniile 60-134) în migrarea nouă,
cu `create or replace`, și adaugă o ramură înainte de `select full_name into aname`:

```sql
  elsif TG_TABLE_NAME = 'transfers' then
    eid := rec.id;
    -- Ziua, instituția și cele două cifre: destul cât să se vadă în jurnal ce
    -- s-a schimbat fără deschiderea rândului.
    det := jsonb_build_object(
      'transfer_date', rec.transfer_date,
      'institution', rec.institution,
      'plecati', rec.plecati,
      'sositi', rec.sositi
    );
```

Apoi trigger-ul:

```sql
drop trigger if exists audit_transfers on transfers;
create trigger audit_transfers after insert or update or delete on transfers
  for each row execute function record_audit();
```

**ATENȚIE:** `record_audit()` e o singură funcție pentru toate tabelele. Dacă o
rescrii fără ramurile existente (`tasks`, `subtasks`, `hearings`, `comments`,
`tags`, `task_tags`, `profiles`, `petitions`...), **le distrugi auditul**. Citește
versiunea curentă din cea mai recentă migrare care o redefinește și pornește de la ea.

**Step 3: Adaugă tipul în TypeScript**

În `src/lib/types.ts`, la `AuditEntry["entity"]`, adaugă `| "transfers"`.

**Step 4: Verifică**

Run: `npm run build` — trebuie să treacă (tipul e folosit doar la compilare).

**Step 5: Commit**

```bash
git add apps/task-manager/supabase/migrations/0020_transfers.sql apps/task-manager/src/lib/types.ts
git commit -m "feat(transfer): migrarea 0020 (tabel, RLS, audit)"
```

---

## Task 2: Mută utilitarele de perioadă în modul comun (refactorizare pură)

**Files:**
- Create: `apps/task-manager/src/lib/periods.ts`
- Create: `apps/task-manager/src/lib/periods.test.ts`
- Modify: `apps/task-manager/src/lib/hearings.ts` (rămâne doar ce ține de ședințe)
- Modify: `apps/task-manager/src/lib/hearings.test.ts` (mută testele mutate)
- Modify: toți importatorii (vezi Step 1)

**Step 1: Găsește importatorii**

Run: `grep -rn "from \"@/lib/hearings\"\|from \"./hearings\"" apps/task-manager/src`

Notează fiecare fișier. Toate importurile de `Period`, `PERIODS`, `rangeForPeriod`,
`DateRange`, `toISODate`, `parseISODate`, `formatDateRo`, `rangeLabelRo` trec pe
`@/lib/periods`.

**Step 2: Mută**

Taie din `hearings.ts` și pune în `periods.ts`, neschimbate: `Period`, `PERIODS`,
`DateRange`, `rangeForPeriod`, `toISODate`, `parseISODate`, `formatDateRo`,
`rangeLabelRo`, cu comentariile lor.

Rămân în `hearings.ts`: `HearingCounts`, `Hearing`, `Indicators`,
`computeIndicators`, `aggregate`, `missingWorkdays`.

**Nu lăsa re-export din `hearings.ts`.** Un shim ar însemna două căi către același
lucru, iar în timp jumătate din cod ar importa pe una și jumătate pe cealaltă.

**Step 3: Mută testele corespunzătoare** din `hearings.test.ts` în `periods.test.ts`,
neschimbate.

**Step 4: Verifică — aici e toată dovada**

Run: `npm test`
Expected: **toate cele 295 de teste trec.** Numărul nu are voie să scadă. Dacă a
scăzut, un test s-a pierdut la mutare, nu „a devenit irelevant".

Run: `npm run build` și `npm run lint` — verzi.

**Step 5: Commit**

```bash
git add apps/task-manager/src/lib/periods.ts apps/task-manager/src/lib/periods.test.ts apps/task-manager/src/lib/hearings.ts apps/task-manager/src/lib/hearings.test.ts
git commit -m "refactor(task-manager): utilitarele de perioadă într-un modul comun"
```

---

## Task 3: Logica transferurilor (TDD)

**Files:**
- Create: `apps/task-manager/src/lib/transfers.ts`
- Create: `apps/task-manager/src/lib/transfers.test.ts`

### Step 1: Scrie testele care pică (RED)

```ts
import { describe, expect, it } from "vitest";
import {
  INSTITUTIONS,
  institutionLabel,
  scheduledDays,
  isScheduled,
  nextScheduled,
  missingScheduled,
  aggregate,
} from "./transfers";
import { toISODate } from "./periods";

describe("instituțiile", () => {
  it("sunt 16: 1-18 fără 6 (noi) și fără 14 (nu există)", () => {
    expect(INSTITUTIONS).toHaveLength(16);
    expect(INSTITUTIONS).not.toContain(6);
    expect(INSTITUTIONS).not.toContain(14);
    expect(INSTITUTIONS[0]).toBe(1);
    expect(INSTITUTIONS.at(-1)).toBe(18);
  });

  it("compune eticheta", () => {
    expect(institutionLabel(3)).toBe("Penitenciarul nr. 3");
  });
});

describe("zilele programate", () => {
  it("prima și a treia luni — iulie 2026 începe miercuri", () => {
    // 1 iulie 2026 = miercuri, deci prima luni e 6, a treia 20.
    expect(scheduledDays(2026, 6).map(toISODate)).toEqual(["2026-07-06", "2026-07-20"]);
  });

  it("când întâi e chiar luni, aceea e prima", () => {
    // 1 iunie 2026 = luni.
    expect(scheduledDays(2026, 5).map(toISODate)).toEqual(["2026-06-01", "2026-06-15"]);
  });

  it("când întâi e duminică, prima luni e a doua zi", () => {
    // 1 noiembrie 2026 = duminică.
    expect(scheduledDays(2026, 10).map(toISODate)).toEqual(["2026-11-02", "2026-11-16"]);
  });

  it("a treia luni rămâne mereu în aceeași lună", () => {
    for (let m = 0; m < 12; m++) {
      const [, third] = scheduledDays(2026, m);
      expect(third.getMonth()).toBe(m);
    }
  });

  it("recunoaște o zi programată și una obișnuită", () => {
    expect(isScheduled(new Date(2026, 6, 6))).toBe(true);
    expect(isScheduled(new Date(2026, 6, 13))).toBe(false); // luni, dar a doua
  });
});

describe("următorul transfer", () => {
  it("îl dă pe cel din luna curentă dacă n-a trecut", () => {
    expect(toISODate(nextScheduled(new Date(2026, 6, 10)))).toBe("2026-07-20");
  });

  it("trece în luna următoare când amândouă au trecut", () => {
    expect(toISODate(nextScheduled(new Date(2026, 6, 25)))).toBe("2026-08-03");
  });

  it("ziua programată de azi e tot ea, nu următoarea", () => {
    expect(toISODate(nextScheduled(new Date(2026, 6, 20)))).toBe("2026-07-20");
  });
});

describe("zilele programate necompletate", () => {
  const range = { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) };

  it("le arată pe cele fără niciun rând", () => {
    const entered = [{ transfer_date: "2026-07-06" }];
    expect(missingScheduled(range, entered, new Date(2026, 6, 25))).toEqual(["2026-07-20"]);
  });

  it("o zi viitoare nu poate lipsi", () => {
    expect(missingScheduled(range, [], new Date(2026, 6, 10))).toEqual(["2026-07-06"]);
  });

  it("nimic de semnalat când sunt completate toate", () => {
    const entered = [{ transfer_date: "2026-07-06" }, { transfer_date: "2026-07-20" }];
    expect(missingScheduled(range, entered, new Date(2026, 6, 25))).toEqual([]);
  });
});

describe("agregarea", () => {
  it("adună și scoate soldul", () => {
    const r = aggregate([
      { plecati: 5, sositi: 2 },
      { plecati: 7, sositi: 0 },
      { plecati: 0, sositi: 7 },
    ]);
    expect(r).toEqual({ plecati: 12, sositi: 9, total: 21, sold: -3 });
  });

  it("soldul e pozitiv când au sosit mai mulți decât au plecat", () => {
    expect(aggregate([{ plecati: 2, sositi: 9 }]).sold).toBe(7);
  });

  it("fără rânduri dă zerouri, nu NaN", () => {
    expect(aggregate([])).toEqual({ plecati: 0, sositi: 0, total: 0, sold: 0 });
  });
});
```

### Step 2: Rulează, confirmă RED

Run: `npm test -- transfers`
Expected: FAIL — „Cannot find module './transfers'".

### Step 3: Implementează minimal

```ts
import { addDays, addMonths, isSameDay, startOfDay, startOfMonth } from "date-fns";
import { toISODate, type DateRange } from "./periods";

/**
 * Penitenciarele partenere. Lipsesc două numere, din motive diferite: nr. 6
 * suntem noi, iar nr. 14 nu există. Constrângerea din baza de date spune
 * același lucru, ca să nu depindă de codul de aici.
 */
export const INSTITUTIONS = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18];

export function institutionLabel(n: number): string {
  return `Penitenciarul nr. ${n}`;
}

/**
 * Prima și a treia zi de luni din lună — zilele de transfer programat.
 *
 * `month` e 0-11, ca la `Date`. A treia luni e mereu prima + 14 zile, iar prima
 * cade cel târziu pe 7, deci a treia nu poate ieși din lună.
 */
export function scheduledDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // getDay(): 0 = duminică … 6 = sâmbătă. Câte zile până la prima luni.
  const offset = (8 - first.getDay()) % 7;
  const firstMonday = addDays(first, offset);
  return [firstMonday, addDays(firstMonday, 14)];
}

export function isScheduled(d: Date): boolean {
  return scheduledDays(d.getFullYear(), d.getMonth()).some((s) => isSameDay(s, d));
}

/** Ziua de transfer programat următoare; azi, dacă azi e chiar ea. */
export function nextScheduled(from: Date): Date {
  const today = startOfDay(from);
  const upcoming = scheduledDays(from.getFullYear(), from.getMonth()).find((d) => d >= today);
  if (upcoming) return upcoming;
  const next = addMonths(startOfMonth(from), 1);
  return scheduledDays(next.getFullYear(), next.getMonth())[0];
}

/**
 * Zilele programate din interval care n-au niciun rând.
 *
 * Într-un registru golul e informația importantă: o zi necompletată nu se vede
 * nicăieri altundeva. Zilele care încă n-au venit sunt sărite — o zi viitoare
 * nu poate lipsi.
 */
export function missingScheduled(
  range: DateRange,
  entered: { transfer_date: string }[],
  today: Date = new Date(),
): string[] {
  const have = new Set(entered.map((t) => t.transfer_date));
  const last = range.to < today ? range.to : today;
  if (last < range.from) return [];

  const out: string[] = [];
  let cursor = startOfMonth(range.from);
  while (cursor <= last) {
    for (const d of scheduledDays(cursor.getFullYear(), cursor.getMonth())) {
      if (d >= range.from && d <= last && !have.has(toISODate(d))) out.push(toISODate(d));
    }
    cursor = addMonths(cursor, 1);
  }
  return out;
}

export interface TransferCounts {
  plecati: number;
  sositi: number;
}

export interface TransferTotals extends TransferCounts {
  total: number;
  /** Sosiți minus plecați: negativ înseamnă că au plecat mai mulți decât au venit. */
  sold: number;
}

export function aggregate(rows: TransferCounts[]): TransferTotals {
  const plecati = rows.reduce((a, r) => a + (r.plecati || 0), 0);
  const sositi = rows.reduce((a, r) => a + (r.sositi || 0), 0);
  return { plecati, sositi, total: plecati + sositi, sold: sositi - plecati };
}
```

### Step 4: Rulează, confirmă GREEN

Run: `npm test -- transfers` → PASS
Run: `npm test` → toate verzi
Run: `npm run build` și `npm run lint` → verzi

### Step 5: Commit

```bash
git add apps/task-manager/src/lib/transfers.ts apps/task-manager/src/lib/transfers.test.ts
git commit -m "feat(transfer): logica zilelor programate și a agregării (TDD)"
```

---

## Task 4: Tip, interogări, Server Actions

**Files:**
- Modify: `apps/task-manager/src/lib/types.ts` (interfața `Transfer`)
- Modify: `apps/task-manager/src/lib/queries.ts` (`getTransfers`)
- Create: `apps/task-manager/src/app/transferuri/actions.ts`

**Step 1: Tipul**

```ts
export interface Transfer {
  id: string;
  transfer_date: string;
  institution: number;
  kind: "planificat" | "urgent";
  plecati: number;
  sositi: number;
  total: number;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Interogarea**

În `queries.ts`, după tiparul lui `getHearings`:

```ts
export async function getTransfers(): Promise<Transfer[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("transfers")
    .select("*")
    .order("transfer_date", { ascending: false })
    .order("institution", { ascending: true });
  return data ?? [];
}
```

**Step 3: Server Actions**

`createTransfer`, `updateTransfer`, `deleteTransfer`. Urmează exact tiparul din
`src/app/sedinte/actions.ts` — citește-l întâi. Obligatoriu:

- `"use server"` sus;
- `.select()` pe update și delete, cu **gardă pe zero rânduri** — fără ea, o
  operație blocată de RLS întoarce succes fără să fi schimbat nimic;
- `revalidatePath("/transferuri")` **și** `revalidatePath("/")` (cardul de hub);
- `created_by` / `updated_by` completate cu utilizatorul curent;
- mesaje de eroare în română, care spun ce s-a întâmplat și ce urmează.

Ciocnirea cu cheia unică (`transfer_date, institution, kind`) e un caz **așteptat**,
nu o eroare de sistem: prinde codul Postgres `23505` și întoarce „Există deja un rând
pentru penitenciarul acesta în ziua asta. Editează-l în loc să adaugi altul."

**Step 4: Verifică**

Run: `npm run build` și `npm run lint` → verzi.

**Step 5: Commit**

```bash
git add apps/task-manager/src/lib/types.ts apps/task-manager/src/lib/queries.ts apps/task-manager/src/app/transferuri/actions.ts
git commit -m "feat(transfer): tip, interogări și acțiuni de server"
```

---

## Task 5: Pagina /transferuri

**Files:**
- Create: `apps/task-manager/src/app/transferuri/page.tsx`
- Create: `apps/task-manager/src/components/transfers/transfer-summary.tsx`
- Create: `apps/task-manager/src/components/transfers/transfer-register.tsx`
- Create: `apps/task-manager/src/components/transfers/transfer-dialog.tsx`

Citește întâi `src/app/sedinte/page.tsx` și componentele lui — pagina asta trebuie să
arate ca o soră a ei, nu ca un modul străin.

**Structura** (vezi macheta aprobată din design):

1. Antet: titlu, selector de perioadă (`PERIODS` din `periods.ts`), buton „Adaugă transfer".
2. Trei cifre pentru perioadă: plecați, sosiți, sold — din `aggregate()`.
3. Avertizare discretă dacă `missingScheduled()` întoarce ceva, plus
   „Următorul transfer: {`nextScheduled()`}".
4. Registrul pe zile, descrescător: antet per zi (data, ziua săptămânii, eticheta
   planificat/urgent, totalurile zilei), sub el câte un rând per instituție.

**Reguli de afișare care nu se negociază:**

- Săgețile diferă **și ca direcție, nu doar ca culoare**: ↑ roșu pentru plecați,
  ↓ verde pentru sosiți. Cine nu distinge roșu de verde citește corect după formă.
- Unde nu e mișcare într-un sens se pune **„—", nu 0**: lipsa mișcării și mișcarea de
  zero valori sunt lucruri diferite.
- `export const dynamic = "force-dynamic";`
- Ștergerea apare doar la admin (curtoazie în interfață; gardul real e RLS).

**Formularul** (`transfer-dialog.tsx`): dată, instituție (`INSTITUTIONS` +
`institutionLabel`), tip, plecați, sosiți, notă. La deschidere, dacă data e o zi
programată (`isScheduled`), tipul e **preselectat „planificat"** — dar rămâne
schimbabil, fiindcă un transfer programat se poate muta.

**Step: Verifică**

Run: `npm run build`, `npm run lint`, `npm test` → verzi.

**Step: Commit**

```bash
git commit -m "feat(transfer): pagina de registru cu zile programate"
```

---

## Task 6: Integrare în aplicație

**Files:**
- Modify: `apps/task-manager/src/components/layout/module-tabs.tsx:7-12`
- Modify: `apps/task-manager/src/lib/audit-modules.ts`
- Modify: `apps/task-manager/src/app/page.tsx` (cardul de hub)

**Step 1: Tabul de modul**

În `MODULES`, după Ședințe:

```ts
{ href: "/transferuri", label: "Transferuri", matchPrefixes: ["/transferuri"] },
```

**Step 2: Modulul de audit**

În `audit-modules.ts`: adaugă `"transferuri"` la tipul `AuditModule` și intrarea
`{ value: "transferuri", label: "Transferuri", entities: ["transfers"] }`.

Adaugă și un test în `audit-modules.test.ts` care verifică că `entitiesFor("transferuri")`
întoarce `["transfers"]`.

**Step 3: Cardul de hub**

În `src/app/page.tsx`, un `ModuleCard` nou cu plecați / sosiți / sold pe **luna
curentă** (`rangeForPeriod("luna")`).

**Modulul nu are responsabil**, deci cardul **nu primește `breakdown`** — spre
deosebire de sarcini și petiții. Nu inventa o defalcare care n-are pe ce sta.

Adaugă `getTransfers()` în `Promise.all`-ul existent, nu ca `await` separat: un
`await` în plus pune încă un drum dus-întors în serie.

**Step 4: Verifică**

Run: `npm run build`, `npm run lint`, `npm test` → verzi.

**Step 5: Commit**

```bash
git commit -m "feat(transfer): tab, audit și card de hub"
```

---

## Task 7: Documentație și verificare finală

**Files:**
- Modify: `apps/task-manager/README.md`

Secțiune nouă „Transferuri": ce ține modulul (cifre, nu persoane — **și de ce**),
forma rândului, regula zilelor programate, și faptul că migrarea `0020` trebuie rulată.

Adaugă `0020_transfers.sql` în lista de migrări din README, dacă există o astfel de listă.

**Verificare finală:**

```bash
npm test && npm run build && npm run lint
```

Toate verzi. Numărul de teste trebuie să fie **mai mare** decât 295, nu egal.

```bash
git commit -m "docs(transfer): documentează modulul de transferuri"
```

---

## Ordine & dependențe

```
1 (migrare) ─┐
2 (refactor) ─┴→ 3 (logică) → 4 (date) → 5 (pagină) → 6 (integrare) → 7 (docs)
```

Task 1 și 2 sunt independente unul de altul și pot merge în orice ordine. Task 3
depinde de 2 (`toISODate`, `DateRange` din `periods.ts`).

## Definition of Done

- [ ] `npm test`, `npm run build`, `npm run lint` verzi; numărul de teste a crescut.
- [ ] Cele 295 de teste existente sunt **toate** încă acolo după refactorizare.
- [ ] Un rând nu poate fi înregistrat pentru penitenciarul nr. 6 sau nr. 14.
- [ ] Ziua programată necompletată se semnalează; o zi viitoare nu.
- [ ] Plecările și sosirile se disting prin direcția săgeții, nu doar prin culoare.
- [ ] Unde nu e mișcare scrie „—", nu 0.
- [ ] Auditul existent (sarcini, petiții, ședințe) funcționează în continuare.
- [ ] Utilizatorul știe că trebuie să ruleze `0020_transfers.sql`.
