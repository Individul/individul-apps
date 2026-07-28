# Petiții — atașamente — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fiecare petiție poate avea fișiere atașate (PDF/JPG/PNG, max 10 MB), grupate în „Petiția" și „Răspunsul", păstrate într-un bucket privat și deschise prin linkuri semnate.

**Architecture:** Bucket privat `petitions` în Supabase Storage + tabelul `petition_attachments`. Browserul urcă fișierul direct în Storage (RLS pe `storage.objects`), apoi o Server Action înregistrează rândul; dacă înregistrarea eșuează, obiectul urcat se șterge. Drepturile refolosesc regula de modificare a petiției (admin/creator/responsabil), impusă atât în RLS, cât și în UI.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Storage), TypeScript, Tailwind + shadcn, Vitest.

**Referință design:** `docs/plans/2026-07-28-petition-attachments-design.md`

---

## Convenții & verificare

- App în `apps/task-manager/`. `npm test` = Vitest (65 teste acum). Verificare per task:
  `npm run build` + `npm test` verzi.
- Migrarea o aplică operatorul uman în Supabase; încărcarea reală se testează după deploy.
- Commit după fiecare task. Fără `any`, fără librării noi.

---

## Task 1: Migrarea 0013 — bucket, tabel, RLS, politici de storage

**Files:**
- Create: `apps/task-manager/supabase/migrations/0013_petition_attachments.sql`
- Modify: `apps/task-manager/supabase/README.md`

**Step 1:** Scrie migrarea:

```sql
-- Bucket privat pentru scanările petițiilor (PDF/JPG/PNG, max 10 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'petitions', 'petitions', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists petition_attachments (
  id uuid primary key default gen_random_uuid(),
  petition_id uuid not null references petitions(id) on delete cascade,
  kind text not null check (kind in ('petitie', 'raspuns')),
  path text not null unique,
  name text not null,
  mime text,
  size integer,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists petition_attachments_petition_idx
  on petition_attachments (petition_id);

alter table petition_attachments enable row level security;

-- Poate utilizatorul curent să modifice petiția? (aceeași regulă ca politica
-- „petitions update": admin / creator / responsabil)
create or replace function can_modify_petition(p_id uuid) returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from petitions p
    where p.id = p_id
      and (is_admin() or p.created_by = auth.uid() or p.assignee_id = auth.uid())
  );
$$;

drop policy if exists "petition_attachments select" on petition_attachments;
create policy "petition_attachments select" on petition_attachments
  for select using (auth.role() = 'authenticated');

drop policy if exists "petition_attachments insert" on petition_attachments;
create policy "petition_attachments insert" on petition_attachments
  for insert with check (
    can_modify_petition(petition_id) and uploaded_by = auth.uid()
  );

drop policy if exists "petition_attachments delete" on petition_attachments;
create policy "petition_attachments delete" on petition_attachments
  for delete using (can_modify_petition(petition_id));

-- ===== Storage: bucket „petitions" =====
-- Calea are forma {petition_id}/{fișier}, deci primul segment identifică petiția.
drop policy if exists "petitions bucket select" on storage.objects;
create policy "petitions bucket select" on storage.objects
  for select using (bucket_id = 'petitions' and auth.role() = 'authenticated');

drop policy if exists "petitions bucket insert" on storage.objects;
create policy "petitions bucket insert" on storage.objects
  for insert with check (
    bucket_id = 'petitions'
    and can_modify_petition(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "petitions bucket delete" on storage.objects;
create policy "petitions bucket delete" on storage.objects
  for delete using (
    bucket_id = 'petitions'
    and can_modify_petition(((storage.foldername(name))[1])::uuid)
  );
```

Notă: dacă primul segment al căii nu e un uuid valid, conversia eșuează și cererea e respinsă —
adică politica **eșuează închis** (refuză), ceea ce e comportamentul dorit.

**Step 2:** În `supabase/README.md` adaugă o secțiune scurtă: rulează `0013_petition_attachments.sql`
după `0012_petitions.sql`; ea creează bucket-ul privat `petitions` și politicile de acces.

**Step 3: Commit** `feat(task-manager): petition attachments schema, bucket and RLS (0013)`

---

## Task 2: Helper-e pure de validare (TDD)

**Files:**
- Create: `apps/task-manager/src/lib/attachments.ts`
- Create: `apps/task-manager/src/lib/attachments.test.ts`

**Step 1: Write the failing test** — `src/lib/attachments.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ACCEPTED_MIME,
  MAX_ATTACHMENT_BYTES,
  validateAttachment,
  formatBytes,
  storageKey,
} from "./attachments";

const f = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: "scan.pdf",
  type: "application/pdf",
  size: 1024,
  ...over,
});

describe("validateAttachment", () => {
  it("acceptă PDF, JPG și PNG", () => {
    expect(validateAttachment(f())).toBeNull();
    expect(validateAttachment(f({ name: "a.jpg", type: "image/jpeg" }))).toBeNull();
    expect(validateAttachment(f({ name: "a.png", type: "image/png" }))).toBeNull();
  });

  it("respinge alte tipuri", () => {
    const err = validateAttachment(f({ name: "a.docx", type: "application/msword" }));
    expect(err).toMatch(/PDF/i);
  });

  it("respinge fișierele peste limită", () => {
    const err = validateAttachment(f({ size: MAX_ATTACHMENT_BYTES + 1 }));
    expect(err).toMatch(/10 MB/);
  });

  it("acceptă exact limita", () => {
    expect(validateAttachment(f({ size: MAX_ATTACHMENT_BYTES }))).toBeNull();
  });

  it("respinge fișierul gol", () => {
    expect(validateAttachment(f({ size: 0 }))).toMatch(/gol/i);
  });
});

describe("formatBytes", () => {
  it("formatează lizibil", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1024 * 1024 * 3)).toBe("3 MB");
  });
  it("rotunjește la o zecimală", () => {
    expect(formatBytes(1536)).toBe("1,5 KB");
  });
});

describe("storageKey", () => {
  it("pune fișierul în folderul petiției și păstrează extensia", () => {
    const key = storageKey("11111111-1111-1111-1111-111111111111", "Scan Petiție (1).pdf");
    expect(key.startsWith("11111111-1111-1111-1111-111111111111/")).toBe(true);
    expect(key.endsWith(".pdf")).toBe(true);
  });
  it("curăță diacriticele și spațiile din nume", () => {
    const key = storageKey("abc", "Petiție răspuns.PDF");
    expect(key).toMatch(/^abc\/[a-z0-9-]+-petitie-raspuns\.pdf$/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- attachments`
Expected: FAIL — modulul nu există.

**Step 3: Write minimal implementation** — `src/lib/attachments.ts`:

```ts
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png";

export type AttachmentKind = "petitie" | "raspuns";

export const KIND_LABEL: Record<AttachmentKind, string> = {
  petitie: "Petiția",
  raspuns: "Răspunsul",
};

/** Întoarce mesajul de eroare sau `null` dacă fișierul e acceptat. */
export function validateAttachment(file: { name: string; type: string; size: number }): string | null {
  if (file.size <= 0) return "Fișierul e gol.";
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    return "Sunt acceptate doar fișiere PDF, JPG sau PNG.";
  }
  if (file.size > MAX_ATTACHMENT_BYTES) return "Fișierul depășește 10 MB.";
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${trim(kb)} KB`;
  return `${trim(kb / 1024)} MB`;
}

function trim(n: number): string {
  // O zecimală, cu virgulă (convenție ro); fără „,0" inutil.
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

/** Cale în bucket: {petitionId}/{uuid}-{nume-curățat}.{ext} */
export function storageKey(petitionId: string, fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > -1 ? fileName.slice(dot + 1).toLowerCase() : "bin";
  const base = fileName.slice(0, dot > -1 ? dot : undefined);
  const slug =
    base
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "fisier";
  return `${petitionId}/${crypto.randomUUID()}-${slug}.${ext}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- attachments` → PASS. Apoi `npm test` → toate verzi (65 + ~10).

**Step 5: Commit**

```bash
git add src/lib/attachments.ts src/lib/attachments.test.ts
git commit -m "feat(task-manager): attachment validation helpers with tests"
```

---

## Task 3: Tip, interogări și Server Actions

**Files:**
- Modify: `apps/task-manager/src/lib/types.ts`
- Modify: `apps/task-manager/src/lib/queries.ts`
- Create: `apps/task-manager/src/app/petitii/attachment-actions.ts`

**Step 1:** În `types.ts` adaugă:
```ts
export interface PetitionAttachment {
  id: string;
  petition_id: string;
  kind: "petitie" | "raspuns";
  path: string;
  name: string;
  mime: string | null;
  size: number | null;
  uploaded_by: string | null;
  created_at: string;
}
```
Și extinde `Petition` cu `attachments_count?: number` (calculat, nu coloană).

**Step 2:** În `queries.ts`:
```ts
export async function getPetitionAttachments(petitionId: string): Promise<PetitionAttachment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("petition_attachments")
    .select("*")
    .eq("petition_id", petitionId)
    .order("created_at", { ascending: true });
  // Grațios dacă migrarea 0013 nu e încă aplicată.
  if (error) return [];
  return (data ?? []) as unknown as PetitionAttachment[];
}
```
Și în `getPetitions()` adaugă numărul de atașamente. Folosește un `select` cu relația și mapează:
```ts
.select("*, assignee:profiles!petitions_assignee_id_fkey(*), petition_attachments(id)")
```
apoi, la mapare, `attachments_count: (row.petition_attachments ?? []).length` și scoate câmpul brut
din obiect. **Important:** dacă migrarea 0013 nu e aplicată, acest `select` dă eroare și
`getPetitions` întoarce `[]` — adică lista petițiilor ar apărea goală. Ca să nu se întâmple asta,
încearcă întâi `select`-ul cu relația și, la eroare, **reia** cu `select`-ul actual (fără relație)
și `attachments_count: 0`. Documentează asta cu un comentariu.

**Step 3:** `src/app/petitii/attachment-actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; success?: boolean };

export async function recordAttachment(input: {
  petitionId: string;
  kind: "petitie" | "raspuns";
  path: string;
  name: string;
  mime: string;
  size: number;
}): Promise<Result> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Neautentificat." };

  const { error } = await supabase.from("petition_attachments").insert({
    petition_id: input.petitionId,
    kind: input.kind,
    path: input.path,
    name: input.name,
    mime: input.mime,
    size: input.size,
    uploaded_by: userId,
  });
  if (error) return { error: error.message };

  revalidatePath("/petitii");
  return { success: true };
}

export async function deleteAttachment(id: string): Promise<Result> {
  const supabase = createClient();

  const { data: row } = await supabase
    .from("petition_attachments")
    .select("path")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("petition_attachments")
    .delete()
    .eq("id", id)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Fișier inexistent sau fără permisiune." };

  // Rândul a dispărut → scoatem și obiectul (best-effort, ca să nu rămână orfan).
  if (row?.path) {
    await supabase.storage.from("petitions").remove([row.path as string]);
  }

  revalidatePath("/petitii");
  return { success: true };
}

/** Link semnat, valabil 60 de secunde, pentru deschiderea fișierului. */
export async function getAttachmentUrl(path: string): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("petitions").createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return { error: error?.message ?? "Nu s-a putut genera linkul." };
  return { url: data.signedUrl };
}
```

**Step 4:** `npm run build` + `npm test` → verzi. **Commit** `feat(task-manager): attachment queries and server actions`

---

## Task 4: Interfața — secțiunea „Fișiere" + indicator în listă

**Files:**
- Create: `apps/task-manager/src/components/petitions/petition-attachments.tsx`
- Modify: `apps/task-manager/src/components/petitions/petition-form-dialog.tsx`
- Modify: `apps/task-manager/src/components/petitions/petitions-list.tsx`

**Step 1:** `petition-attachments.tsx` (`"use client"`). Props:
`{ petitionId: string; attachments: PetitionAttachment[]; canEdit: boolean }`.

Structură: două grupe (`petitie`, `raspuns`) folosind `KIND_LABEL`. Pentru fiecare grupă:
- lista fișierelor: iconiță (`FileText` pentru PDF, `Image` pentru imagini), numele, mărimea
  (`formatBytes`), buton „Deschide" și, dacă `canEdit`, buton de ștergere (`Trash2`) cu
  `window.confirm("Ștergi acest fișier?")`;
- dacă `canEdit`, un `<input type="file" accept={ACCEPT_ATTR}>` (stilizat ca buton „Adaugă fișier").

Încărcarea (client):
```tsx
const supabase = createClient(); // din "@/lib/supabase/client"
const err = validateAttachment(file);
if (err) { toast.error(err); return; }
const path = storageKey(petitionId, file.name);
const up = await supabase.storage.from("petitions").upload(path, file, { contentType: file.type });
if (up.error) { toast.error(up.error.message); return; }
const res = await recordAttachment({ petitionId, kind, path, name: file.name, mime: file.type, size: file.size });
if (res.error) {
  await supabase.storage.from("petitions").remove([path]); // fără orfani
  toast.error(res.error);
  return;
}
toast.success("Fișier atașat");
router.refresh();
```
Deschiderea: `const { url, error } = await getAttachmentUrl(a.path); if (url) window.open(url, "_blank", "noopener");`
Folosește `useTransition`/un `uploading` state ca să dezactivezi controalele în timpul încărcării.

**Step 2:** `petition-form-dialog.tsx` — sub câmpuri, înainte de `DialogFooter`, adaugă secțiunea
„Fișiere":
- dacă `petition` există: `<PetitionAttachments petitionId={petition.id} attachments={attachments} canEdit={!readOnly} />`;
- dacă nu (creare): un text muted „Salvează petiția, apoi atașează fișierele."
Atașamentele vin printr-un prop nou `attachments?: PetitionAttachment[]` pe dialog (încărcate în
pagină) SAU se încarcă la deschidere printr-o Server Action — alege varianta cu cel mai puțin
zgomot; dacă le încarci în pagină, adaugă-le în `petitii/page.tsx` doar pentru petiția editată nu e
posibil (dialogul e client), deci **preferă** o încărcare la deschiderea dialogului
(`useEffect` + o Server Action `listAttachments(petitionId)` adăugată în `attachment-actions.ts`).

**Step 3:** `petitions-list.tsx` — în celula „Nr." (sau lângă titlu), dacă
`(p.attachments_count ?? 0) > 0`, afișează o agrafă (`Paperclip`, `h-3.5 w-3.5`) + numărul, muted,
cu `title={`${n} fișier(e) atașat(e)`}`.

**Step 4:** `npm run build` + `npm test` → verzi.

**Step 5: Commit** `feat(task-manager): petition attachments UI`

---

## Ordine & dependențe

```
1 (migrare) → 2 (helper-e TDD) → 3 (tip/queries/actions) → 4 (UI)
```

## Definition of Done

- [ ] `npm test` verde; `npm run build` fără erori.
- [ ] Migrarea 0013 aplicată în Supabase; bucket `petitions` **privat**.
- [ ] Se pot atașa PDF/JPG/PNG ≤10 MB, grupate în Petiția/Răspunsul; răspunsul rămâne opțional.
- [ ] Fișierele se deschid doar prin linkuri semnate; utilizatorii fără drept de modificare pot
      doar vizualiza.
- [ ] Lista arată agrafa + numărul pe petițiile cu fișiere.
- [ ] Dacă migrarea nu e aplicată, lista de petiții continuă să funcționeze (fără atașamente).
