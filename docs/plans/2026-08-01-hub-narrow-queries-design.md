# Interogări înguste pentru pagina de start — Design

**Data:** 2026-08-01

## Problema, măsurată

Pagina de start afișează unsprezece cifre și două tabele de defalcare. Ca să le
obțină, aduce din Supabase:

- **toate petițiile**, cu toate cele 17 coloane, plus lista atașamentelor fiecăreia;
- **toate sarcinile**, fiecare cu profilul complet al responsabilului încorporat și
  toate etichetele ei;
- **tot registrul de transferuri**.

Măsurat în baza reală, prin `sum(length(row_to_json(...)))`:

| Tabel | Rânduri | Acum | Cu doar coloanele folosite |
| --- | --- | --- | --- |
| petiții | 326 | 157 kB | 26 kB |
| sarcini | 35 | 15 kB | 3 kB |
| transferuri | 6 | 2,1 kB | 0,2 kB |
| **total** | | **~174 kB** | **~29 kB** |

Cifra „acum" e optimistă: nu numără join-urile către atașamente, profiluri și
etichete, care vin pe deasupra.

Din tot ce se transferă, calculul citește:

- `taskStats` — `status`, `due_date`. Atât. Nici măcar prioritatea.
- `petitionStats` — `status`, `response_deadline`.
- `groupByAssignee` — `assignee_id`.
- `aggregate` / `byInstitution` — `transfer_date`, `institution`, `plecati`, `sositi`.

## Ce câștigăm cu adevărat, ca să nu ne mințim

Cele 174 kB circulă între Supabase și funcția Vercel, **amândouă în Frankfurt**.
Transferul propriu-zis e de ordinul milisecundelor. Ce se economisește e
serializarea în Postgres, parsarea celor 174 kB de JSON în funcție și parcurgerea
structurilor mari în JavaScript — realist, **20-60 ms** din cele ~540 până la
DOMContentLoaded.

Restul secundei e JavaScript de client: 253 kB transferați, 880 kB de resurse.
Schimbarea asta nu-l atinge deloc.

**Deci nu se face pentru azi, ci pentru peste doi ani.** La 326 de petiții pierzi
40 ms; la 1500 vei pierde 200, și atunci va fi o problemă adevărată, reparată sub
presiune. Acum e ieftină și sigură.

## Soluția

**Se îngustează tipul acceptat de funcțiile de statistici, nu semnătura lor.**
`taskStats(tasks: Task[])` devine `taskStats(tasks: TaskCounts[])`, unde
`TaskCounts = Pick<Task, "status" | "due_date">`. Fiindcă TypeScript compară
structuri, nu nume, toate apelurile existente cu `Task[]` complet merg neatinse.

**Trei interogări noi, folosite doar de pagina de start**, care cer exact coloanele
de mai sus. `getTasks()` și `getPetitions()` rămân neschimbate — paginile lor chiar
au nevoie de tot.

## Proprietatea care ține schimbarea sigură în timp

Dacă peste un an cineva adaugă în `taskStats` o linie care citește `t.priority`,
**TypeScript refuză compilarea**: interogarea îngustă nu aduce câmpul acela.

Fără garanția asta, optimizarea ar fi o capcană — statistica ar citi un câmp venit
mereu `undefined` și ar număra greșit, tăcut. Cu ea, sincronizarea dintre ce cere
calculul și ce aduce interogarea nu se poate rupe fără eroare de compilare.

## Verificarea

**Cele 431 de teste existente rămân verzi, neatinse.** Ele verifică deja că
`taskStats` și `petitionStats` dau cifrele corecte; dacă trec și după îngustare,
comportamentul e identic. Un test nou, scris odată cu codul, n-ar dovedi nimic —
ar verifica ce tocmai am scris, nu ce era înainte.

## Ce nu se face

Nu se mută numărătoarea în Postgres (o funcție care întoarce direct cifrele). Ar fi
mai bună pe termen lung, dar mută logica din TypeScript testat în SQL netestat, și
nu se justifică înainte de a vedea dacă varianta simplă e de-ajuns.

## Fișiere afectate

- `src/lib/hub-stats.ts` — tipurile parametrilor.
- `src/lib/queries.ts` — trei interogări noi.
- `src/app/page.tsx` — le folosește.
