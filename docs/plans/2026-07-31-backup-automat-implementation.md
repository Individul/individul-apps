# Backup automat — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** În fiecare zi, automat, baza de date întreagă și fișierele noi ajung într-un repo privat pe GitHub — iar dacă se oprește, se vede.

**Architecture:** Vercel Cron cheamă zilnic o rută protejată cu secret. Ruta citește cu cheia de serviciu (ocolind RLS), scrie un fișier pe zi cu toate tabelele, și urcă doar fișierele care lipsesc față de un manifest. Fiecare rulare se înregistrează într-un tabel; o avertizare apare când ultima reușită e mai veche de 3 zile.

**Tech Stack:** Next.js 14 Route Handlers, Supabase service-role client, GitHub Contents API, Vitest.

**Referință design:** `docs/plans/2026-07-31-backup-automat-design.md`

---

## Convenții & verificare

- App în `apps/task-manager/`. `npm test` = Vitest (**341 teste** acum).
- **Fără alias `@/` în vitest** — modulele testate se importă relativ.
- Verificare per task: `npm run build`, `npm run lint`, `npm test` verzi.
- Commit după fiecare task. Fără `any`. Comentariile explică **de ce**, în română.
- **Nu inventa chei, tokenuri sau secrete.** Toate vin din variabile de mediu.

## Cele 15 tabele

```
audit_log  comments  hearings  notifications  petition_attachments  petitions
profiles  stat_reports  stat_values  subtasks  tags  task_tags  tasks
transfer_plans  transfers
```

Ordinea la restaurare (dependențe): `profiles` → `tasks` → `subtasks`, `comments`,
`tags`, `task_tags` → `petitions` → `petition_attachments` → restul.

---

## Task 1: Migrarea 0022 — evidența rulărilor

**Files:** Create `apps/task-manager/supabase/migrations/0022_backup_runs.sql`

```sql
-- Evidența rulărilor de backup. Fără ea, o copie care se oprește în tăcere e
-- mai rea decât lipsa uneia: te crezi acoperit tocmai când nu ești.

create table if not exists backup_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  tables_count integer not null default 0,
  rows_count integer not null default 0,
  -- Fișiere urcate la rularea asta, și câte mai sunt de recuperat. A doua cifră
  -- deosebește „merge, dar încă recuperează restanța" de „s-a stricat".
  files_uploaded integer not null default 0,
  files_pending integer not null default 0,
  error text
);

create index if not exists backup_runs_started_idx on backup_runs (started_at desc);

alter table backup_runs enable row level security;

-- Doar adminul citește. Scrierea o face exclusiv cheia de serviciu, care
-- ocolește RLS oricum — deci nu există politică de insert: nimeni din aplicație
-- nu poate falsifica o rulare reușită.
drop policy if exists "backup_runs select" on backup_runs;
create policy "backup_runs select" on backup_runs
  for select using (is_admin());
```

**Nu atinge `record_audit()`.** Rulările de backup nu sunt acțiuni de utilizator și
n-au ce căuta în jurnalul de audit.

**Verifică:** `npm run build`.
**Commit:** `feat(backup): migrarea 0022 (evidența rulărilor)`

---

## Task 2: Logica pură (TDD)

**Files:**
- Create: `apps/task-manager/src/lib/backup.ts`
- Create: `apps/task-manager/src/lib/backup.test.ts`

### Step 1: Testele (RED)

```ts
import { describe, expect, it } from "vitest";
import { dumpPath, filePath, missingFiles, isStale, type StoredFile } from "./backup";

describe("căile din repo", () => {
  it("baza de date primește un fișier pe zi", () => {
    expect(dumpPath(new Date(2026, 6, 31))).toBe("db/2026-07-31.json");
  });

  it("fișierele păstrează bucketul în cale, ca să nu se ciocnească", () => {
    expect(filePath("petitions", "2026/cerere.pdf")).toBe("files/petitions/2026/cerere.pdf");
  });
});

describe("ce lipsește față de manifest", () => {
  const inBucket: StoredFile[] = [
    { bucket: "petitions", name: "a.pdf", size: 10 },
    { bucket: "petitions", name: "b.pdf", size: 20 },
    { bucket: "statistics", name: "c.xlsx", size: 30 },
  ];

  it("le dă pe cele care nu sunt salvate", () => {
    const saved = [{ bucket: "petitions", name: "a.pdf", size: 10 }];
    expect(missingFiles(inBucket, saved).map((f) => f.name)).toEqual(["b.pdf", "c.xlsx"]);
  });

  it("nimic de urcat când manifestul le are pe toate", () => {
    expect(missingFiles(inBucket, inBucket)).toEqual([]);
  });

  it("același nume în buckete diferite sunt fișiere diferite", () => {
    const bucket: StoredFile[] = [
      { bucket: "petitions", name: "x.pdf", size: 1 },
      { bucket: "statistics", name: "x.pdf", size: 1 },
    ];
    const saved = [{ bucket: "petitions", name: "x.pdf", size: 1 }];
    expect(missingFiles(bucket, saved)).toHaveLength(1);
    expect(missingFiles(bucket, saved)[0].bucket).toBe("statistics");
  });

  it("un fișier care și-a schimbat mărimea se urcă din nou", () => {
    // Scanurile nu se schimbă, dar dacă totuși se întâmplă, tăcerea ar fi
    // pierdere de date: manifestul ar spune „salvat" pentru altceva.
    const saved = [{ bucket: "petitions", name: "a.pdf", size: 999 }];
    expect(missingFiles(inBucket, saved).map((f) => f.name)).toContain("a.pdf");
  });
});

describe("vechimea copiei", () => {
  const azi = new Date(2026, 6, 31);

  it("o reușită de ieri e în regulă", () => {
    expect(isStale("2026-07-30T02:00:00Z", azi)).toBe(false);
  });

  it("trei zile încă trec", () => {
    expect(isStale("2026-07-28T02:00:00Z", azi)).toBe(false);
  });

  it("a patra zi e prea mult", () => {
    expect(isStale("2026-07-27T02:00:00Z", azi)).toBe(true);
  });

  it("nicio reușită vreodată înseamnă învechit", () => {
    // Nu „în regulă până la proba contrarie": un backup care n-a rulat
    // niciodată e exact cazul în care trebuie să afli.
    expect(isStale(null, azi)).toBe(true);
  });
});
```

### Step 2: Rulează, confirmă RED.

Run: `npm test -- backup`
Expected: FAIL — „Cannot find module './backup'".

### Step 3: Implementează

```ts
import { differenceInCalendarDays, format } from "date-fns";

export interface StoredFile {
  bucket: string;
  name: string;
  size: number;
}

/** Un fișier pe zi pentru baza de date; git le păstrează pe toate. */
export function dumpPath(d: Date): string {
  return `db/${format(d, "yyyy-MM-dd")}.json`;
}

/** Bucketul intră în cale: două buckete pot avea fișiere cu același nume. */
export function filePath(bucket: string, name: string): string {
  return `files/${bucket}/${name}`;
}

const keyOf = (f: StoredFile) => `${f.bucket}/${f.name}/${f.size}`;

/**
 * Ce e în buckete și nu e în manifest.
 *
 * Mărimea intră în cheie, nu doar numele: dacă un fișier a fost înlocuit cu
 * altul sub același nume, manifestul ar spune „salvat" pentru un conținut pe
 * care nu-l are. Scanurile nu se schimbă, dar tăcerea în cazul contrar ar
 * însemna pierdere de date.
 */
export function missingFiles(inBucket: StoredFile[], saved: StoredFile[]): StoredFile[] {
  const have = new Set(saved.map(keyOf));
  return inBucket.filter((f) => !have.has(keyOf(f)));
}

/**
 * A trecut prea mult de la ultima rulare reușită?
 *
 * `null` — nicio reușită vreodată — înseamnă învechit, nu „în regulă până la
 * proba contrarie": exact atunci trebuie să afli.
 */
export function isStale(lastSuccessISO: string | null, today: Date, maxDays = 3): boolean {
  if (!lastSuccessISO) return true;
  return differenceInCalendarDays(today, new Date(lastSuccessISO)) > maxDays;
}
```

### Step 4: GREEN — `npm test`, `npm run build`, `npm run lint`.
### Step 5: Commit `feat(backup): logica pură a copiei de siguranță (TDD)`

---

## Task 3: Clientul GitHub

**Files:** Create `apps/task-manager/src/lib/github.ts`

Un singur lucru de făcut: **scrie un fișier în repo**. Contents API:
`PUT /repos/{owner}/{repo}/contents/{path}`, conținut în base64.

```ts
const API = "https://api.github.com";

interface PutResult { ok: true } | { ok: false; error: string }

/**
 * Scrie (sau suprascrie) un fișier în repo-ul de backup.
 *
 * Contents API cere `sha`-ul versiunii curente ca să suprascrie, deci se caută
 * întâi. Lipsa lui (404) e cazul obișnuit — fișier nou — nu o eroare.
 */
export async function putFile(
  path: string,
  content: Buffer,
  message: string,
): Promise<PutResult>
```

**Cerințe:**
- `GITHUB_BACKUP_REPO` (formă `owner/nume`) și `GITHUB_BACKUP_TOKEN` din mediu;
  dacă lipsesc, întoarce eroare limpede în română, nu aruncă;
- antet `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`,
  `X-GitHub-Api-Version: 2022-11-28`;
- **nu scrie niciodată tokenul în vreun mesaj de eroare sau log.** E capcana
  clasică: `error: ${JSON.stringify(config)}` scapă cheia în evidența rulărilor,
  care ajunge apoi ea însăși în backup.
- funcție separată `getFileSha(path)` care întoarce `string | null`.

Verifică `npm run build` + `npm run lint`.
Commit: `feat(backup): client GitHub pentru scrierea fișierelor`

---

## Task 4: Ruta de cron

**Files:** Create `apps/task-manager/src/app/api/backup/route.ts`

```ts
export const dynamic = "force-dynamic";
// Un minut: descărcarea și urcarea fișierelor sunt lente. Limita de fișiere pe
// rulare (mai jos) ține rularea sub prag.
export const maxDuration = 60;
```

**Pașii, în ordine:**

1. **Poarta.** Antetul `Authorization: Bearer ${process.env.CRON_SECRET}` trebuie să
   corespundă. Altfel `401`. Fără secret setat în mediu → `500` cu mesaj limpede;
   **nu** rula neprotejat.
2. Deschide o rulare în `backup_runs` (`ok = false`). Dacă funcția moare la mijloc,
   rândul rămâne pe eșec — exact ce trebuie.
3. **Baza de date.** Cu `createAdminClient()`, citește toate cele 15 tabele
   (`select("*")`), fiecare cu `order` stabil. Compune un obiect
   `{ app, version: 2, exported_at, counts, data }` și urcă-l la `dumpPath(new Date())`.
4. **Manifestul.** Citește `manifest.json` din repo (lipsă → listă goală).
5. **Fișierele.** `storage.from(b).list()` pentru `petitions` și `statistics`,
   recursiv pe foldere. `missingFiles(...)`, apoi **primele `FILES_PER_RUN = 15`**.
6. Pentru fiecare: descarcă din Supabase, urcă la `filePath(...)`.
7. Actualizează `manifest.json` cu cele urcate.
8. Închide rularea: `ok = true`, cifrele, `files_pending` = câte au mai rămas.

**Despre limita de fișiere.** Prima rulare nu poate urca toate scanurile într-un
minut. De aceea se iau 15 pe zi, iar backfill-ul se întinde pe câteva zile.
`files_pending` spune cât a rămas — de aceea o rulare cu restanță e tot o **reușită**,
nu un eșec. Dacă restanța nu scade de la o zi la alta, aia e problemă, și se vede din
evidență.

**Erorile** se prind și se scriu în `backup_runs.error`, apoi se întoarce `500`.
O rulare eșuată trebuie să lase urmă; una care moare tăcut e cel mai rău caz.

Verifică `npm run build` + `npm run lint`.
Commit: `feat(backup): ruta zilnică de copiere`

---

## Task 5: Butonul existent acoperă toate tabelele

**Files:** Modify `apps/task-manager/src/app/admin/backup/route.ts`

Acum salvează 5 tabele din 15 — a rămas la modulul de sarcini. Extinde-l la toate
cele 15, cu același format ca ruta de cron (`version: 2`), ca cele două să producă
fișiere identice ca structură.

**Verifică și `src/components/admin/restore-backup.tsx`:** dacă presupune formatul
vechi, trebuie să respingă limpede un fișier `version: 2` („restaurarea automată
acoperă doar formatul vechi — vezi README") în loc să importe pe jumătate. **Nu
extinde restaurarea la 15 tabele** — vezi designul.

Verifică `npm run build` + `npm run lint` + `npm test`.
Commit: `fix(backup): butonul salvează toate cele 15 tabele`

---

## Task 6: Avertizarea

**Files:**
- Create: `apps/task-manager/src/components/admin/backup-status.tsx`
- Modify: `apps/task-manager/src/app/admin/page.tsx`
- Modify: `apps/task-manager/src/lib/queries.ts` (`getLastBackupRun`)

Pe `/admin`, sub titlu: data ultimei rulări reușite, câte fișiere mai sunt de
recuperat, și — dacă `isStale(...)` — o bandă de avertizare care spune **ce să
verifici**, nu doar că e rău.

Ex.: „Ultima copie reușită: 27 iulie. Verifică jurnalul de rulări în Vercel."

Verifică `npm run build` + `npm run lint` + `npm test`.
Commit: `feat(backup): starea copiei pe pagina de administrare`

---

## Task 7: Cron, documentație, procedura de restaurare

**Files:**
- Modify: `apps/task-manager/vercel.json`
- Modify: `apps/task-manager/README.md`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"],
  "crons": [{ "path": "/api/backup", "schedule": "0 2 * * *" }]
}
```

Ora 2 noaptea, când nu lucrează nimeni.

**README** — secțiune nouă „Copie de siguranță":

1. **Ce acoperă Supabase Pro și ce nu** — baza da, 7 zile; fișierele **deloc**.
2. **Ce face copia noastră** și de ce fișierele se copiază doar o dată.
3. **Configurarea, pas cu pas:** repo privat nou → token fine-grained cu
   Contents:write **doar pe el** → variabilele în Vercel: `GITHUB_BACKUP_REPO`,
   `GITHUB_BACKUP_TOKEN`, `CRON_SECRET`.
4. **Procedura de restaurare**, cu ordinea tabelelor de mai sus și mențiunea că
   utilizatorii se creează din nou manual (conturile de autentificare nu se copiază).
5. **Migrarea `0022` trebuie rulată.**

Commit: `docs(backup): configurare și procedura de restaurare`

---

## Ordine & dependențe

```
1 (migrare) → 2 (logică) → 3 (GitHub) → 4 (ruta cron) → 6 (avertizare) → 7 (docs)
                                     5 (butonul) — independent, oricând
```

## Definition of Done

- [ ] `npm test`, `npm run build`, `npm run lint` verzi; testele au crescut peste 341.
- [ ] Butonul manual salvează toate cele 15 tabele, nu cinci.
- [ ] Ruta de cron refuză cererile fără secretul corect.
- [ ] O rulare eșuată lasă urmă în `backup_runs`, cu motivul.
- [ ] O rulare cu restanță de fișiere e reușită, nu eșec.
- [ ] Tokenul nu apare în niciun mesaj de eroare, log sau rând din evidență.
- [ ] Avertizarea apare când nu există nicio rulare reușită, nu doar când e veche.
- [ ] Utilizatorul știe ce are de configurat și cum se restaurează.
