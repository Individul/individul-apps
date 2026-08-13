# Modulul Eliberări — plan de implementare

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Un registru nominal al eliberărilor, cu lista lunii curente pe pagina de start și un anunț automat în ziua eliberării.

**Architecture:** Tabel nou `release_plans` în Supabase, separat de registrul de cifre `releases`. Logica pură (luna curentă, starea unui rând, destinatarii anunțului) stă în `src/lib/releases.ts`, testată cu Vitest. Anunțul zilnic e o funcție SQL rulată de `pg_cron` — sarcinile programate de pe Vercel sunt deja ocupate de copia de siguranță. Interfața: un chenar pe `/` și o sub-pagină `/eliberari`, fără tab nou în antet.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (Postgres + RLS + pg_cron), Tailwind + shadcn/ui, Vitest.

**Design:** `docs/plans/2026-08-13-eliberari-design.md`

**Ramura:** `eliberari` (deja creată, pornită din `main` la `b27dac6`)

---

## Context pentru cine execută

Câteva convenții ale proiectului care nu se ghicesc din cod:

- **Ziua de azi vine din `todayInChisinau()`**, ca valoare implicită de parametru (`today: Date = todayInChisinau()`). Niciodată `new Date()`: pe Vercel serverul merge pe UTC și „azi" ar sări cu o zi între miezurile de noapte. Vezi comentariul de la începutul lui `src/lib/transfers.ts`.
- **Datele sunt text `AAAA-LL-ZZ`**, nu obiecte `Date`, peste tot unde traversează baza de date. Comparația de text e și comparație de calendar. `parseISODate` / `toISODate` din `src/lib/periods.ts` fac conversia.
- **Fiecare listă derivă dintr-un `Record<Uniune, …>`**, prin `optionsFrom()` din `src/lib/options.ts`. O listă scrisă de mână pe lângă un tip e boala care a produs deja trei bug-uri în proiect (stări lipsă din filtru, cinci tabele din cincisprezece în backup).
- **Auditul are funcție proprie per tabel**, nu o ramură în `record_audit()`. Vezi comentariul din `0026_releases.sql:44`.
- **Comentariile din cod sunt în română** și explică *de ce*, nu *ce*. Citește `src/lib/obligations.ts` pentru ton.
- **Interogările sunt „grațioase" dacă migrarea nu e aplicată** — `if (error) return []`, ca în `getTransferPlans`.

Comenzi:

```bash
cd apps/task-manager && npm test
```

```bash
cd apps/task-manager && npm run build
```

---

## Task 1: Migrarea 0027

**Files:**
- Create: `apps/task-manager/supabase/migrations/0027_release_plans.sql`

Fără cod de aplicație și fără teste — migrarea singură. Se rulează manual în Supabase, de către utilizator, după ce e revizuită.

**Step 1: Scrie migrarea**

Model: `0021_transfer_plans.sql` (tabel nominal, RLS, funcție de audit proprie).

```sql
-- Evidența nominală a eliberărilor.
--
-- Separată de `releases`, care ține cifra lunară pentru raportul de marți: una
-- e numărul raportat conducerii, cealaltă e lista de lucru. Din cifră nu se
-- poate reveni la nume, iar din nume nu se completează automat cifra — vezi
-- designul pentru motiv.

create table if not exists release_plans (
  id uuid primary key default gen_random_uuid(),

  last_name text not null check (length(trim(last_name)) > 0),
  first_name text not null check (length(trim(first_name)) > 0),

  release_date date not null,

  -- Temeiurile reale din darea de seamă a ANP (`LIBERATI_MOTIVE` din
  -- src/lib/stats/report-views.ts). Toate nouăsprezece, nu o selecție: un temei
  -- lipsă împinge omul spre „alte motive" și informația se pierde tăcut.
  -- Lista e oglindită în `ReleaseGround` din src/lib/releases.ts, iar un test
  -- citește fișierul ăsta și cade dacă cele două se depărtează.
  ground text not null check (ground in (
    'termen_executat', 'art_91', 'art_108', 'art_107', 'art_95', 'art_92',
    'achitati_csj_ca', 'mecanism_compensatoriu', 'alte_motive',
    'incetarea_procesului', 'inlocuire_arest', 'revocare_arest',
    'expirare_termen_legal', 'expirare_termen_instanta', 'achitare',
    'pedeapsa_neprivativa', 'scoatere_urmarire', 'amnistiati_preveniti',
    'arest_contraventional'
  )),

  -- S-a eliberat efectiv. Fără bifă, o dată trecută nu spune dacă omul a ieșit
  -- sau dacă instanța a schimbat ceva în ultima zi.
  done boolean not null default false,

  -- Când a plecat anunțul. Nu un boolean: ora rămâne utilă când cineva întreabă
  -- de ce n-a văzut nimic dimineața.
  notified_at timestamptz,

  note text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fără unicitate pe (nume, dată): omonimele există, iar doi oameni se pot
-- elibera în aceeași zi cu același temei.
create index if not exists release_plans_date_idx on release_plans (release_date);

drop trigger if exists release_plans_updated_at on release_plans;
create trigger release_plans_updated_at before update on release_plans
  for each row execute function set_updated_at();

alter table release_plans enable row level security;

-- Ca la celelalte registre ale secției: oricine autentificat citește și
-- completează, ștergerea e a adminului, cine a scris rămâne în audit.
drop policy if exists "release_plans select" on release_plans;
create policy "release_plans select" on release_plans
  for select using (auth.role() = 'authenticated');

drop policy if exists "release_plans insert" on release_plans;
create policy "release_plans insert" on release_plans
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "release_plans update" on release_plans;
create policy "release_plans update" on release_plans
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "release_plans delete" on release_plans;
create policy "release_plans delete" on release_plans
  for delete using (is_admin());

-- Funcție proprie, nu o ramură în `record_audit()`: vezi 0026:44.
-- Date nominale, deci orice atingere lasă urmă.
create or replace function record_release_plan_audit() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  rec record;
  det jsonb;
  aname text;
begin
  if (TG_OP = 'DELETE') then rec := OLD; else rec := NEW; end if;

  det := jsonb_build_object(
    'name', rec.last_name || ' ' || rec.first_name,
    'release_date', rec.release_date,
    'ground', rec.ground
  );
  if TG_OP = 'UPDATE' then
    if NEW.release_date is distinct from OLD.release_date then
      det := det || jsonb_build_object('date_from', OLD.release_date,
                                       'date_to', NEW.release_date);
    end if;
    if NEW.done is distinct from OLD.done then
      det := det || jsonb_build_object('done_to', NEW.done);
    end if;
  end if;

  select full_name into aname from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), aname, TG_OP, 'release_plans', rec.id, det);
  return null;
end;
$$;

drop trigger if exists audit_release_plans on release_plans;
create trigger audit_release_plans
  after insert or update or delete on release_plans
  for each row execute function record_release_plan_audit();


-- ---------------------------------------------------------------------------
-- Responsabilul de eliberări
-- ---------------------------------------------------------------------------

-- Bifă pe profil, nu un id scris în cod. Un id ar merge azi și ar tăcea în ziua
-- în care omul pleacă din funcție — fără eroare, fără urmă. Din bifă ies două
-- lucruri: cui pleacă anunțul și eticheta „Responsabil: …" de pe chenar.
alter table profiles add column if not exists handles_releases boolean not null default false;


-- ---------------------------------------------------------------------------
-- Anunțul din ziua eliberării
-- ---------------------------------------------------------------------------

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('assigned', 'comment', 'status', 'edited', 'deleted', 'created', 'eliberare'));

-- Anunțurile de azi. Rulată zilnic de pg_cron, întoarce câte a trimis.
--
-- `security definer` fiindcă scrie în `notifications` pentru alți utilizatori,
-- iar politica de acolo permite doar rândurile proprii.
--
-- Mesajul nu conține temeiul: eticheta lui trăiește în TypeScript, iar copiată
-- aici ar fi a doua listă de întreținut — exact tiparul pe care modulul îl
-- evită peste tot.
create or replace function notify_todays_releases() returns integer
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_recipients uuid[];
  v_count integer := 0;
  r record;
begin
  select coalesce(array_agg(id), '{}') into v_recipients
    from profiles where handles_releases;

  -- Nimeni bifat: merge la administratori. O funcție care amuțește dintr-o bifă
  -- uitată e mai rea decât una care anunță pe cine nu trebuie.
  if coalesce(array_length(v_recipients, 1), 0) = 0 then
    select coalesce(array_agg(id), '{}') into v_recipients
      from profiles where role = 'admin';
  end if;
  if coalesce(array_length(v_recipients, 1), 0) = 0 then return 0; end if;

  for r in
    select id, last_name, first_name from release_plans
    where release_date = (now() at time zone 'Europe/Chisinau')::date
      and not done
      and notified_at is null
  loop
    insert into notifications (user_id, type, message)
    select u, 'eliberare', 'Azi se eliberează ' || r.last_name || ' ' || r.first_name
    from unnest(v_recipients) as u;

    -- Ștampila cade în aceeași tranzacție cu inserarea, deci al doilea anunț nu
    -- mai pleacă niciodată — nici dacă sarcina programată rulează de două ori.
    update release_plans set notified_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Programarea, dacă extensia e activată. Blocul e păzit ca migrarea să treacă
-- și pe o bază fără pg_cron: funcția rămâne apelabilă manual, iar activarea se
-- poate face oricând după.
--
-- 04:00 UTC = 07:00 la Chișinău vara, 06:00 iarna. Ora exactă nu contează;
-- contează să fie înainte de programul de lucru.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('eliberari-azi', '0 4 * * *',
                          'select notify_todays_releases()');
  else
    raise notice 'pg_cron nu e activat: anunțul zilnic de eliberări nu e programat. Activează extensia și rulează cron.schedule manual (vezi supabase/README.md).';
  end if;
end $$;
```

**Step 2: Verifică sintaxa fără să rulezi nimic**

Nu ai acces la baza de date. Recitește migrarea comparând-o cu `0021_transfer_plans.sql` și `0026_releases.sql`: aceleași patru politici, același tipar de funcție de audit, `set_updated_at()` scris identic.

**Step 3: Commit**

```bash
git add apps/task-manager/supabase/migrations/0027_release_plans.sql
git commit -m "feat(eliberari): migrarea 0027 — tabel nominal, responsabil, anunț zilnic"
```

---

## Task 2: Tipurile și registrele care trebuie să afle de tabelul nou

Un tabel nou trebuie anunțat în șase locuri. Testele existente prind două dintre ele — începe cu ele, ca să vezi garda funcționând.

**Files:**
- Modify: `apps/task-manager/src/lib/types.ts`
- Modify: `apps/task-manager/src/lib/backup-dump.ts`
- Modify: `apps/task-manager/src/lib/audit-modules.ts:44`
- Modify: `apps/task-manager/src/lib/audit-modules.test.ts:13-29`
- Modify: `apps/task-manager/src/components/admin/audit-table.tsx:31-65`

**Step 1: Rulează testele ca să vezi garda căzând**

```bash
cd apps/task-manager && npm test -- backup-dump
```

Așteptat: **FAIL** — „tabele care există în bază dar nu intră în copie: release_plans". Testul citește migrările, deci a aflat de tabel din Task 1 fără să-i spună nimeni. Asta e exact garda pe care o vrem; restul task-ului o satisface.

**Step 2: Adaugă tabelul în copia de siguranță**

În `src/lib/backup-dump.ts`, în `BACKUP_TABLES`, **imediat după `transfer_plans`** (părintele `profiles` vine deja mai sus, iar ordinea contează la restaurare):

```ts
  { name: "release_plans", order: ["release_date", "id"] },
```

**Step 3: Tipurile**

În `src/lib/types.ts`:

- `Profile` primește `handles_releases: boolean;`
- `NotificationType` primește `| "eliberare"`
- `AuditEntry["entity"]` primește `| "release_plans"` (caută uniunea entităților și adaug-o lângă `releases`)

**Step 4: Registrele de audit**

`src/lib/audit-modules.ts:44` — modulul „Eliberări" ține acum două entități:

```ts
  { value: "eliberari", label: "Eliberări", entities: ["releases", "release_plans"] },
```

`src/lib/audit-modules.test.ts:13-29` — `ENTITY_PRESENT` primește `release_plans: true`. (Fără asta compilarea cade: e un `Record` peste uniune.)

`src/components/admin/audit-table.tsx` — `ENTITY_ICON` primește `release_plans: DoorOpen`, iar `ENTITY_LABEL` primește `release_plans: "eliberarea"`.

**Step 5: Rulează toate testele**

```bash
cd apps/task-manager && npm test
```

Așteptat: **PASS**, toate. Dacă `audit-modules.test.ts` se plânge că „Eliberări" nu mai întoarce ce trebuie, actualizează așteptarea din test.

**Step 6: Commit**

```bash
git add apps/task-manager/src
git commit -m "feat(eliberari): tabelul nou intră în backup, audit și tipuri"
```

---

## Task 3: Logica pură (TDD)

**Files:**
- Create: `apps/task-manager/src/lib/releases.ts`
- Create: `apps/task-manager/src/lib/releases.test.ts`

**Step 1: Scrie testele**

`src/lib/releases.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  RELEASE_GROUNDS,
  groundLabel,
  groupedGroundOptions,
  fullName,
  releaseState,
  monthSummary,
  notificationRecipients,
  responsibleLabel,
  shiftMonth,
  readMonth,
  monthLabelRo,
  type ReleasePlan,
} from "./releases";
import type { Profile } from "./types";

function plan(over: Partial<ReleasePlan> = {}): ReleasePlan {
  return {
    id: crypto.randomUUID(),
    last_name: "Popescu",
    first_name: "Ion",
    release_date: "2026-08-20",
    ground: "termen_executat",
    done: false,
    notified_at: null,
    note: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: crypto.randomUUID(),
    full_name: "Ana Cojocari",
    username: null,
    avatar_url: null,
    role: "member",
    handles_releases: false,
    ...over,
  };
}

const AZI = new Date(2026, 7, 14); // 14 august 2026

describe("temeiurile", () => {
  it("sunt nouăsprezece", () => {
    expect(Object.keys(RELEASE_GROUNDS)).toHaveLength(19);
  });

  it("se împart în condamnați și preveniți, nouă și zece", () => {
    const grupe = groupedGroundOptions();
    expect(grupe.map((g) => g.category)).toEqual(["condamnati", "preveniti"]);
    expect(grupe[0].options).toHaveLength(9);
    expect(grupe[1].options).toHaveLength(10);
  });

  it("dă eticheta scrisă, nu codul", () => {
    expect(groundLabel("art_91")).toBe("Art. 91 (condiționat)");
  });
});

describe("fullName", () => {
  it("pune numele de familie primul, ca în registru", () => {
    expect(fullName(plan({ last_name: "Rusu", first_name: "Vasile" }))).toBe("Rusu Vasile");
  });
});

describe("releaseState", () => {
  it("bifat înseamnă gata, indiferent de dată", () => {
    expect(releaseState(plan({ release_date: "2026-08-01", done: true }), AZI)).toBe("gata");
    expect(releaseState(plan({ release_date: "2026-08-31", done: true }), AZI)).toBe("gata");
  });

  it("azi e o stare de sine stătătoare", () => {
    expect(releaseState(plan({ release_date: "2026-08-14" }), AZI)).toBe("azi");
  });

  it("o dată trecută și nebifată e restanță", () => {
    expect(releaseState(plan({ release_date: "2026-08-13" }), AZI)).toBe("restant");
  });

  it("restul e viitor", () => {
    expect(releaseState(plan({ release_date: "2026-08-15" }), AZI)).toBe("viitor");
  });
});

describe("monthSummary", () => {
  const luna = [
    plan({ release_date: "2026-08-03", done: true }),
    plan({ release_date: "2026-08-10", done: true }),
    plan({ release_date: "2026-08-14" }),
    plan({ release_date: "2026-08-20" }),
    plan({ release_date: "2026-08-12" }), // trecut, nebifat
  ];

  it("numără tot, dar listează doar ce a rămas", () => {
    const s = monthSummary(luna, "2026-08", AZI);
    expect(s.total).toBe(5);
    expect(s.done).toBe(2);
    expect(s.remaining).toHaveLength(3);
  });

  it("pune restanțele primele, apoi cronologic", () => {
    // O dată trecută și nebifată e singura care cere o acțiune azi; îngropată
    // între datele viitoare, ar trece neobservată exact cât contează.
    const s = monthSummary(luna, "2026-08", AZI);
    expect(s.remaining.map((r) => r.plan.release_date)).toEqual([
      "2026-08-12",
      "2026-08-14",
      "2026-08-20",
    ]);
    expect(s.remaining.map((r) => r.state)).toEqual(["restant", "azi", "viitor"]);
  });

  it("nu ia rândurile din alte luni", () => {
    const s = monthSummary([...luna, plan({ release_date: "2026-09-01" })], "2026-08", AZI);
    expect(s.total).toBe(5);
  });

  it("o lună goală nu e o eroare", () => {
    const s = monthSummary([], "2026-08", AZI);
    expect(s).toEqual({ total: 0, done: 0, remaining: [] });
  });
});

describe("notificationRecipients", () => {
  it("cei bifați ca responsabili", () => {
    const ana = profile({ handles_releases: true });
    const altul = profile();
    expect(notificationRecipients([ana, altul])).toEqual([ana.id]);
  });

  it("fără nimeni bifat, administratorii", () => {
    // Altfel o bifă uitată face funcția să amuțească, fără niciun semn.
    const admin = profile({ role: "admin" });
    const membru = profile();
    expect(notificationRecipients([admin, membru])).toEqual([admin.id]);
  });

  it("bifa bate rolul: adminul nebifat nu primește dacă există un responsabil", () => {
    const ana = profile({ handles_releases: true });
    const admin = profile({ role: "admin" });
    expect(notificationRecipients([ana, admin])).toEqual([ana.id]);
  });
});

describe("responsibleLabel", () => {
  it("numele celui bifat", () => {
    expect(responsibleLabel([profile({ full_name: "Ana Cojocari", handles_releases: true })])).toBe(
      "Ana Cojocari",
    );
  });

  it("mai mulți, despărțiți prin virgulă", () => {
    const doi = [
      profile({ full_name: "Ana Cojocari", handles_releases: true }),
      profile({ full_name: "Ion Rusu", handles_releases: true }),
    ];
    expect(responsibleLabel(doi)).toBe("Ana Cojocari, Ion Rusu");
  });

  it("nimeni bifat: null, deci eticheta nu se afișează deloc", () => {
    expect(responsibleLabel([profile()])).toBeNull();
  });
});

describe("navigarea între luni", () => {
  it("shiftMonth trece corect peste marginea anului", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("readMonth cade pe luna curentă la valori lipsă sau imposibile", () => {
    expect(readMonth("2026-03", AZI)).toBe("2026-03");
    expect(readMonth(undefined, AZI)).toBe("2026-08");
    expect(readMonth("2026-13", AZI)).toBe("2026-08");
    expect(readMonth("august", AZI)).toBe("2026-08");
  });

  it("monthLabelRo scrie luna pe românește", () => {
    expect(monthLabelRo("2026-08")).toBe("august 2026");
  });
});
```

**Step 2: Rulează testele ca să le vezi căzând**

```bash
cd apps/task-manager && npm test -- releases
```

Așteptat: **FAIL** — „Failed to resolve import ./releases".

**Step 3: Scrie `src/lib/releases.ts`**

Copiază antetul explicativ despre fusul orar de la începutul lui `src/lib/transfers.ts`.

Punctele care contează:

```ts
export type ReleaseCategory = "condamnati" | "preveniti";

export type ReleaseGround =
  | "termen_executat" | "art_91" | "art_108" | "art_107" | "art_95" | "art_92"
  | "achitati_csj_ca" | "mecanism_compensatoriu" | "alte_motive"
  | "incetarea_procesului" | "inlocuire_arest" | "revocare_arest"
  | "expirare_termen_legal" | "expirare_termen_instanta" | "achitare"
  | "pedeapsa_neprivativa" | "scoatere_urmarire" | "amnistiati_preveniti"
  | "arest_contraventional";

/**
 * Temeiurile, cu eticheta și categoria lor.
 *
 * Un singur Record, nu trei liste: categoria scrisă separat ar fi a doua copie
 * de întreținut, iar meniul derulant s-ar depărta tăcut de tip. `Record` peste
 * uniune înseamnă că un temei nou nu compilează până nu-și primește și
 * eticheta, și categoria.
 *
 * Etichetele sunt cele din `LIBERATI_MOTIVE` (src/lib/stats/report-views.ts):
 * aceleași cuvinte pe care le citește omul în darea de seamă.
 *
 * Ordinea e ordinea din meniu — condamnații întâi, fiindcă sunt cazul obișnuit.
 */
export const RELEASE_GROUNDS: Record<
  ReleaseGround,
  { label: string; category: ReleaseCategory }
> = {
  termen_executat: { label: "Termen executat", category: "condamnati" },
  art_91: { label: "Art. 91 (condiționat)", category: "condamnati" },
  art_108: { label: "Grațiați (art. 108)", category: "condamnati" },
  art_107: { label: "Amnistiați (art. 107)", category: "condamnati" },
  art_95: { label: "Boală (art. 95)", category: "condamnati" },
  art_92: { label: "Art. 92 (pedeapsă blândă)", category: "condamnati" },
  achitati_csj_ca: { label: "Achitați (CSJ/CA)", category: "condamnati" },
  mecanism_compensatoriu: { label: "Mecanism compensatoriu", category: "condamnati" },
  alte_motive: { label: "Alte motive", category: "condamnati" },
  incetarea_procesului: { label: "Încetarea procesului", category: "preveniti" },
  inlocuire_arest: { label: "Înlocuire arest preventiv", category: "preveniti" },
  revocare_arest: { label: "Revocare arest preventiv", category: "preveniti" },
  expirare_termen_legal: { label: "Expirare termen legal", category: "preveniti" },
  expirare_termen_instanta: { label: "Expirare termen instanță", category: "preveniti" },
  achitare: { label: "Achitare", category: "preveniti" },
  pedeapsa_neprivativa: { label: "Pedeapsă neprivativă", category: "preveniti" },
  scoatere_urmarire: { label: "Scoatere de sub urmărire", category: "preveniti" },
  amnistiati_preveniti: { label: "Amnistiați", category: "preveniti" },
  arest_contraventional: { label: "Arest contravențional", category: "preveniti" },
};

export const CATEGORY_LABEL: Record<ReleaseCategory, string> = {
  condamnati: "Condamnați",
  preveniti: "Preveniți",
};
```

Restul semnăturilor:

```ts
export interface ReleasePlan {
  id: string;
  last_name: string;
  first_name: string;
  release_date: string;
  ground: ReleaseGround;
  done: boolean;
  notified_at: string | null;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ReleaseState = "gata" | "restant" | "azi" | "viitor";

export interface ReleaseRow {
  plan: ReleasePlan;
  state: ReleaseState;
}

export interface MonthSummary {
  total: number;
  done: number;
  /** Doar cele nebifate, restanțele primele. */
  remaining: ReleaseRow[];
}

export function groundLabel(g: ReleaseGround): string;
export function groupedGroundOptions(): {
  category: ReleaseCategory;
  label: string;
  options: { value: ReleaseGround; label: string }[];
}[];
export function fullName(p: Pick<ReleasePlan, "last_name" | "first_name">): string;
export function releaseState(p: ReleasePlan, today?: Date): ReleaseState;
export function monthSummary(plans: ReleasePlan[], month: string, today?: Date): MonthSummary;
export function notificationRecipients(profiles: Profile[]): string[];
export function responsibleLabel(profiles: Profile[]): string | null;
export function shiftMonth(month: string, delta: number): string;
export function readMonth(value: string | undefined, today?: Date): string;
export function monthLabelRo(month: string): string;
```

Detalii de implementare:

- Luna e text `AAAA-LL`. Apartenența la lună se verifică cu `plan.release_date.startsWith(month)` — datele sunt text ISO, deci prefixul e suficient și nu trece prin `Date`.
- `readMonth` respinge ce nu e `^\d{4}-(0[1-9]|1[0-2])$`, ca `readWeek` din `weekly-report.ts`.
- `monthLabelRo` folosește `format(…, "LLLL yyyy", { locale: ro })` din date-fns. Atenție: `LLLL` (formă de sine stătătoare), nu `MMMM`, altfel româna dă cazul greșit.
- `notificationRecipients` și `responsibleLabel` citesc aceeași bifă. `responsibleLabel` întoarce `null`, nu „nimeni": chemătorul ascunde eticheta, nu scrie un gol.
- `monthSummary` sortează restanțele primele, apoi după dată, ca `sortPending` din `obligations.ts`.

**Step 4: Rulează testele**

```bash
cd apps/task-manager && npm test -- releases
```

Așteptat: **PASS**, toate.

**Step 5: Commit**

```bash
git add apps/task-manager/src/lib/releases.ts apps/task-manager/src/lib/releases.test.ts
git commit -m "feat(eliberari): temeiurile, starea unui rând și luna curentă (TDD)"
```

---

## Task 4: Testul care leagă TypeScript de migrare

Fără el, lista din `RELEASE_GROUNDS` și lista din `check (ground in …)` sunt două copii care se pot depărta. O nepotrivire nu s-ar vedea la compilare, nici în teste: ar apărea abia când cineva alege temeiul lipsă și baza de date refuză salvarea.

**Files:**
- Create: `apps/task-manager/src/lib/releases-schema.test.ts`

**Step 1: Scrie testul**

Model: `src/lib/backup-dump.test.ts` (citirea migrărilor, plus verificarea că parserul chiar a citit ceva).

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { RELEASE_GROUNDS } from "./releases";
import type { NotificationType } from "./types";

const MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations",
);

/** Valorile dintr-un `check (<coloană> in ('a', 'b', …))`. */
function checkValues(sql: string, column: string): string[] {
  const m = new RegExp(`check\\s*\\(\\s*${column}\\s+in\\s*\\(([^)]*)\\)`, "i").exec(sql);
  if (!m) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

const SQL = readFileSync(join(MIGRATIONS, "0027_release_plans.sql"), "utf8");

describe("temeiurile din TypeScript și cele din bază", () => {
  const dinSql = checkValues(SQL, "ground");
  const dinCod = Object.keys(RELEASE_GROUNDS);

  it("parserul chiar a citit migrarea", () => {
    // Fără garda asta, o cale greșită sau un regex stricat ar compara două
    // liste goale și testul ar trece — adică exact garda care lipsea.
    expect(dinSql.length, "nu s-a citit nimic din 0027").toBeGreaterThan(0);
  });

  it("sunt aceleași, în ambele sensuri", () => {
    expect([...dinSql].sort()).toEqual([...dinCod].sort());
  });
});

describe("tipurile de notificare", () => {
  it("„eliberare" e permis și în bază", () => {
    const permise = checkValues(SQL, "type");
    expect(permise).toContain("eliberare");
  });

  it("uniunea din TypeScript nu a rămas în urmă", () => {
    // Record peste uniune: dacă cineva adaugă un tip nou fără să treacă pe aici,
    // compilarea cade.
    const PREZENT: Record<NotificationType, true> = {
      assigned: true, comment: true, status: true,
      edited: true, deleted: true, created: true, eliberare: true,
    };
    const permise = checkValues(SQL, "type");
    for (const t of permise) expect(Object.keys(PREZENT)).toContain(t);
  });
});
```

**Step 2: Rulează**

```bash
cd apps/task-manager && npm test -- releases-schema
```

Așteptat: **PASS**. Dacă nu trece, e o nepotrivire reală între Task 1 și Task 3 — repar-o, nu slăbi testul.

**Step 3: Verifică sincer că testul poate cădea**

Schimbă temporar un cod de temei în `releases.ts` (`art_91` → `art_911`), rulează testul, confirmă **FAIL**, apoi pune-l la loc. Un test derivat care nu cade niciodată nu păzește nimic.

**Step 4: Commit**

```bash
git add apps/task-manager/src/lib/releases-schema.test.ts
git commit -m "test(eliberari): temeiurile din cod nu se pot depărta de migrare"
```

---

## Task 5: Interogări și Server Actions

**Files:**
- Modify: `apps/task-manager/src/lib/queries.ts`
- Create: `apps/task-manager/src/app/eliberari/actions.ts`

**Step 1: Interogarea**

În `src/lib/queries.ts`, lângă `getReleases` (linia ~340):

```ts
/**
 * Evidența nominală a eliberărilor dintr-o lună (`AAAA-LL`).
 *
 * Doar luna cerută, nu registrul întreg: pagina de start și pagina modulului
 * arată o singură lună, iar peste ani lista ar crește fără folos.
 */
export async function getReleasePlans(month: string): Promise<ReleasePlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("release_plans")
    .select("*")
    .gte("release_date", `${month}-01`)
    .lte("release_date", `${month}-31`)
    .order("release_date", { ascending: true });
  // Grațios dacă migrarea 0027 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as ReleasePlan[];
}
```

`${month}-31` e sigur: comparația e pe `date`, iar o zi inexistentă ca 31 februarie nu se compară — Postgres primește textul, îl convertește și `2026-02-31` ar da eroare. **Folosește în schimb** `lt("release_date", primaZiDinLunaUrmătoare)`, cu `shiftMonth(month, 1) + "-01"`. Scrie comentariul care spune de ce nu e `-31`.

**Step 2: Server Actions**

`src/app/eliberari/actions.ts`, model: `src/app/transferuri/planificare/actions.ts` (citește-l întâi).

Trei acțiuni: `saveReleasePlan(input)` (insert sau update după prezența lui `id`), `setReleaseDone(id, done)`, `deleteReleasePlan(id)`.

Reguli, aceleași ca la planificarea transferurilor:
- `created_by` / `updated_by` din `auth.getUser()`
- validare: nume nevide, `ground` din `RELEASE_GROUNDS`, dată `AAAA-LL-ZZ`
- `.select()` după fiecare scriere, iar lista goală înseamnă „nu mai există sau n-ai dreptul" — RLS refuză tăcut, nu cu eroare
- `revalidatePath("/eliberari")` **și** `revalidatePath("/")`, fiindcă chenarul de pe pagina de start citește aceleași rânduri

**Step 3: Verifică compilarea**

```bash
cd apps/task-manager && npm run build
```

**Step 4: Commit**

```bash
git add apps/task-manager/src/lib/queries.ts apps/task-manager/src/app/eliberari/actions.ts
git commit -m "feat(eliberari): interogarea lunii și acțiunile de scriere"
```

---

## Task 6: Comutatorul „responsabil de eliberări" pe /admin

**Files:**
- Modify: `apps/task-manager/src/app/admin/actions.ts`
- Modify: `apps/task-manager/src/components/admin/user-role-table.tsx`

**Step 1: Acțiunea**

În `src/app/admin/actions.ts`, după `setUserRole`:

```ts
/**
 * Cine e responsabil de eliberări.
 *
 * Bifă, nu id scris în cod: vezi comentariul din migrarea 0027. Pot fi bifați
 * mai mulți — un înlocuitor pe perioada concediului nu cere nicio schimbare de
 * cod.
 */
export async function setHandlesReleases(userId: string, on: boolean) { … }
```

Aceeași formă ca `setUserRole`: client obișnuit (RLS lasă adminul să scrie în `profiles`), `.select()`, lista goală = fără permisiune. `revalidatePath("/admin")` și `revalidatePath("/")`.

Fără protecția „nu ți-o poți lua ție": spre deosebire de rol, aici nu te poți încuia pe dinafară.

**Step 2: Coloana în tabel**

În `user-role-table.tsx`, o a treia coloană „Eliberări" cu un `Checkbox` (`@/components/ui/checkbox`; dacă nu există componenta shadcn, adaug-o). Antetul primește un `title` care explică: „Primește anunțul în ziua eliberării".

**Step 3: Verifică**

```bash
cd apps/task-manager && npm run build && npm test
```

**Step 4: Commit**

```bash
git add apps/task-manager/src
git commit -m "feat(eliberari): responsabilul se bifează pe pagina de administrare"
```

---

## Task 7: Chenarul de pe pagina de start

**Files:**
- Create: `apps/task-manager/src/components/hub/release-band.tsx`
- Modify: `apps/task-manager/src/app/page.tsx`

**Step 1: Componenta**

Model de stil: `src/components/hub/transfer-band.tsx`.

```tsx
export function ReleaseBand({
  summary,
  month,
  responsible,
}: {
  summary: MonthSummary;
  /** `AAAA-LL`, pentru titlu și pentru linkul spre pagină. */
  month: string;
  /** Numele celor bifați, sau `null` dacă nu e bifat nimeni. */
  responsible: string | null;
})
```

Cerințe de aspect, în ordinea importanței:

1. **Rândurile rămase se așază pe coloane**: `sm:grid-cols-2 lg:grid-cols-3`. Cincisprezece eliberări trebuie să ocupe cinci rânduri înălțime, nu cincisprezece. Ăsta e motivul pentru care chenarul e acceptabil pe pagina de start; fără el, cardurile ar fi împinse afară din ecran.
2. **Un rând = o linie**: `14 aug · Popescu Ion · art. 91`. Numele nu se taie; temeiul se taie cu `truncate` dacă nu încape.
3. **Stările se disting și fără culoare** — o pastilă „AZI" și una „RESTANT", nu doar roșu și portocaliu. (Vezi comentariul din `transfer-band.tsx:62` despre săgeți.)
4. **Când `remaining` e gol**, o singură linie: „Toate cele {total} eliberări din {luna} sunt înregistrate." Iar când `total` e 0: „Nicio eliberare înregistrată în {luna}." Cele două nu se confundă — una spune „gata", cealaltă „gol".
5. Sus, la dreapta, `Responsabil: {responsible}` — doar dacă nu e `null`.
6. Jos, la dreapta, link „Toate eliberările" spre `/eliberari`.

Chenarul întreg **nu** e un `<Link>`, spre deosebire de `TransferBand`: rândurile vor primi ulterior bifa, iar un link părinte ar înghiți clicurile.

**Step 2: Pe pagină**

În `src/app/page.tsx`:

- adaugă `getReleasePlans(luna)` în `Promise.all` (luna curentă: `toISODate(todayInChisinau()).slice(0, 7)`)
- calculează `monthSummary(...)` și `responsibleLabel(profiles)`
- pune `<ReleaseBand … />` **imediat sub `<ObligationBand />`**, înaintea grilei de carduri

Comentariul de deasupra, în stilul celorlalte: de ce e acolo sus și de ce arată doar ce a rămas.

**Step 3: Verifică în browser**

Pornește previzualizarea și uită-te la pagină. Chenarul trebuie să încapă în primul ecran împreună cu titlul și cu marginea de sus a cardurilor. Verifică și la lățime de telefon (`resize_window` preset `mobile`): coloanele trebuie să cadă la una singură, fără derulare orizontală.

Dacă nu ai date în baza locală, verifică cel puțin starea goală și fă o captură.

**Step 4: Commit**

```bash
git add apps/task-manager/src
git commit -m "feat(eliberari): chenarul lunii curente pe pagina de start"
```

---

## Task 8: Pagina /eliberari

**Files:**
- Create: `apps/task-manager/src/app/eliberari/page.tsx`
- Create: `apps/task-manager/src/components/releases/release-list.tsx`
- Create: `apps/task-manager/src/components/releases/release-dialog.tsx`
- Modify: `apps/task-manager/src/app/transferuri/page.tsx`

**Step 1: Pagina**

Model: `src/app/transferuri/planificare/page.tsx`. Citește luna din `searchParams.luna` prin `readMonth`, aduce `getReleasePlans(luna)`, `getReleases(primaZi, ultimaZi)` (registrul de cifre, pentru comparație) și profilurile.

Sub listă, linia de comparație:

> „12 nume în listă, 11 în registrul de cifre pentru august."

Se arată **doar când cele două diferă**, altfel e zgomot. Nu se corectează nimic automat: sunt două evidențe cu rosturi diferite, iar una derivată din cealaltă ar ascunde exact nepotrivirea care merită văzută. Când registrul de cifre n-are niciun rând pentru lună (`available` fals sau listă goală), linia nu apare — „11 vs 0" ar fi o alarmă falsă în prima zi a lunii.

**Step 2: Lista și fereastra de editare**

Model: `src/components/transfers/plan-list.tsx` și `plan-dialog.tsx`. Citește-le pe amândouă înainte să scrii.

- lista: rânduri grupate pe stare (restanțe, azi, urmează, înregistrate), bifa „eliberat" pe fiecare rând, click pe rând deschide fereastra
- ștergerea doar pentru admin (`isAdmin`), ca la planificare
- fereastra: nume, prenume, dată, temei (meniu grupat prin `groupedGroundOptions()`, cu `SelectGroup`/`SelectLabel`), notă
- navigarea între luni: două butoane și eticheta `monthLabelRo(luna)`, cu link-uri care schimbă `?luna=`

**Step 3: Linkul din transferuri**

Nu există tab în antet, deci pagina trebuie să fie găsibilă din două locuri. Chenarul e unul; al doilea e paragraful de sub titlul din `src/app/transferuri/page.tsx:31-39`, unde stă deja linkul spre planificare — adaugă unul spre `/eliberari` lângă el.

**Step 4: Verifică în browser**

Deschide `/eliberari`, adaugă un rând, bifează-l, schimbă luna. Verifică în consolă că nu apar erori.

**Step 5: Commit**

```bash
git add apps/task-manager/src
git commit -m "feat(eliberari): pagina registrului nominal"
```

---

## Task 9: Anunțul în interfață, documentație, verificare finală

**Files:**
- Modify: `apps/task-manager/src/lib/desktop-notifications.ts:27-31`
- Modify: `apps/task-manager/src/lib/desktop-notifications.test.ts`
- Modify: `apps/task-manager/supabase/README.md`
- Modify: `apps/task-manager/README.md`

**Step 1: Unde duce notificarea (TDD)**

Anunțul de eliberare n-are nici `task_id`, nici `petition_id`, deci `notificationHref` întoarce azi `null` — adică o notificare pe care n-o poți deschide.

Scrie întâi testul în `desktop-notifications.test.ts`:

```ts
it("anunțul de eliberare duce la registrul eliberărilor", () => {
  expect(notificationHref(notif({ type: "eliberare" }))).toBe("/eliberari");
});
```

Rulează, vezi **FAIL** (primește `null`). Apoi adaugă ramura în `notificationHref`, înaintea celorlalte verificări:

```ts
  if (n.type === "eliberare") return "/eliberari";
```

Rulează, vezi **PASS**.

**Step 2: Documentația migrării**

În `apps/task-manager/supabase/README.md`, secțiunea pentru 0027. Scrie explicit pașii pe care îi face **utilizatorul**, fiindcă nu se fac din cod:

1. rulează `0027_release_plans.sql` în SQL Editor
2. Database → Extensions → activează `pg_cron`
3. rulează o dată:
   ```sql
   select cron.schedule('eliberari-azi', '0 4 * * *', 'select notify_todays_releases()');
   ```
4. verificare: `select * from cron.job;` trebuie să arate rândul
5. probă imediată, fără să aștepți dimineața: `select notify_todays_releases();` — întoarce câte anunțuri a trimis

Scrie și cum se oprește: `select cron.unschedule('eliberari-azi');`

**Step 3: Documentația modulului**

În `apps/task-manager/README.md`, la lista de module: ce e registrul nominal, cu ce diferă de cifra din raportul de marți, unde se bifează responsabilul.

**Step 4: Verificare finală**

```bash
cd apps/task-manager && npm test && npm run lint && npm run build
```

Toate trei trebuie să treacă. Numărul de teste va fi vizibil mai mare decât 499 — notează cifra reală în raport, nu una prezisă.

**Step 5: Commit**

```bash
git add apps/task-manager
git commit -m "feat(eliberari): notificarea duce la registru, plus documentația"
```

---

## Ce rămâne pentru utilizator

Nimic din ce urmează nu se poate face din cod:

1. rularea migrării 0027 în Supabase
2. activarea `pg_cron` și programarea sarcinii
3. bifarea Anei Cojocari ca responsabilă, pe `/admin`
4. o probă: adaugă o eliberare cu data de azi, rulează `select notify_todays_releases();` și verifică clopoțelul

## Verificare de acceptare

- [ ] Pagina de start arată luna curentă, cu cele rămase, în cel mult cinci rânduri înălțime la cincisprezece eliberări
- [ ] O dată trecută și nebifată se vede ca restanță, distinct și fără culoare
- [ ] `/eliberari` permite adăugare, editare, bifare, ștergere (admin) și navigare între luni
- [ ] Nepotrivirea dintre numărul de nume și cifra din registru se vede când există
- [ ] Bifa de pe `/admin` schimbă atât eticheta de pe chenar, cât și destinatarul anunțului
- [ ] `notify_todays_releases()` trimite o dată și numai o dată pentru fiecare rând
- [ ] Testele derivate din migrare cad dacă listele se depărtează (verificat prin stricare intenționată)
- [ ] `npm test`, `npm run lint`, `npm run build` — toate verzi
