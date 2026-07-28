# Petiții — atașamente (PDF / JPG / PNG) — Design

**Data:** 2026-07-28
**Autor:** brainstorming cu Claude Code
**Context:** `apps/task-manager`, modulul Petiții. Nu există încă nicio infrastructură de
fișiere în aplicație (niciun bucket, niciun upload).

## Scop

Scanarea petiției (și, opțional, a răspunsului) să fie atașată la înregistrare, ca dosarul
electronic să fie complet.

## Decizii (din brainstorming)

| Subiect | Decizie |
|---|---|
| Câte fișiere | Mai multe per petiție, **grupate pe tip**: `petitie` / `raspuns` |
| Răspunsul | **Opțional** — nimic nu-l cere, se atașează când există |
| Formate | PDF, JPG/JPEG, **PNG** |
| Mărime maximă | **10 MB** per fișier |
| Confidențialitate | **Bucket privat + linkuri semnate cu expirare** (nu public) |

## Confidențialitate — de ce bucket privat

Petițiile provin de la deținuți, avocați și persoane civile: conțin date personale și, adesea,
plângeri. Un bucket public ar face fiecare document accesibil oricui cunoaște adresa, fără
autentificare și fără urmă. Prin urmare: bucket **privat**, iar deschiderea unui fișier se face
printr-un **link semnat cu expirare scurtă**, generat la cerere, doar pentru utilizatori
autentificați.

## Model de date

Bucket Storage: **`petitions`** (privat). Cale: `{petition_id}/{uuid}-{nume-fișier}`.

Tabel nou `petition_attachments`:

| Coloană | Tip |
|---|---|
| `id` | uuid, PK |
| `petition_id` | uuid → `petitions(id)` on delete cascade |
| `kind` | text, check în (`petitie`, `raspuns`) |
| `path` | text — calea în bucket |
| `name` | text — numele original al fișierului |
| `mime` | text |
| `size` | integer (bytes) |
| `uploaded_by` | uuid → `profiles(id)` |
| `created_at` | timestamptz |

Index pe `(petition_id)`.

## Drepturi

Aceleași reguli ca la modificarea petiției — reutilizăm `canEditPetition`
(admin **sau** creator **sau** responsabil), impuse pe două niveluri:

- **RLS pe `petition_attachments`:** `select` pentru orice autentificat; `insert`/`delete` doar
  dacă utilizatorul poate modifica petiția-părinte (verificare `exists (...)` pe `petitions`).
- **Politici de storage** pe bucket-ul `petitions`: `select` pentru autentificați;
  `insert`/`delete` cu aceeași verificare, folosind primul segment din cale
  (`(storage.foldername(name))[1]`) ca `petition_id`.

## Fluxul de încărcare

1. Browserul urcă fișierul **direct în Storage** (client Supabase + RLS).
2. O Server Action înregistrează rândul în `petition_attachments`.
3. Dacă pasul 2 eșuează, fișierul urcat se **șterge** (fără orfani).

Motivul pentru încărcarea directă: prin Server Action, corpul cererii e plafonat (~4,5 MB pe
Vercel) și e mai lent. Direct-to-storage e abordarea standard.

Validare (tip + mărime) atât în interfață, cât și la nivel de bucket.

## Interfață

- În **dialogul petiției**, secțiunea „Fișiere", cu două grupe: **Petiția** și **Răspunsul**.
  Fiecare grupă: lista fișierelor (nume, mărime, buton de deschidere, buton de ștergere) și un
  control de încărcare. Ștergerea și încărcarea apar doar cui are dreptul; în mod „doar
  vizualizare" fișierele se pot doar deschide.
- În **listă**, un indicator discret (agrafă + număr) pe petițiile care au atașamente.
- Deschiderea unui fișier cere un link semnat printr-o Server Action și îl deschide în tab nou.

## Constrângere acceptată

Fișierele se pot atașa **doar după ce petiția a fost salvată** (are nevoie de un ID). La creare,
secțiunea afișează „Salvează petiția, apoi atașează fișierele." Alternativa (încărcare într-o
zonă temporară, mutată la salvare) adaugă complexitate reală pentru un câștig mic.

## Testare

- **Unit (Vitest):** validarea fișierului (tip acceptat, limita de 10 MB, mesaje de eroare) și
  formatarea mărimii — funcții pure.
- Drepturile refolosesc `canEditPetition`, deja testat.
- **Build** verde; verificarea funcțională (încărcare reală) o face utilizatorul după deploy,
  fiind nevoie de Storage live.

## Migrare

`supabase/migrations/0013_petition_attachments.sql` — bucket privat, tabelul, indexul, RLS și
politicile de storage. De rulat în Supabase după `0012_petitions.sql`.

## Fișiere afectate (estimare)

- Nou: migrarea 0013; `src/lib/attachments.ts` (+ test); `src/app/petitii/attachment-actions.ts`;
  `src/components/petitions/petition-attachments.tsx`.
- Modificate: `src/lib/types.ts` (tip `PetitionAttachment`), `src/lib/queries.ts` (încărcarea
  atașamentelor / numărul lor), `src/components/petitions/petition-form-dialog.tsx` (secțiunea
  „Fișiere"), `src/components/petitions/petitions-list.tsx` (indicatorul din listă).
