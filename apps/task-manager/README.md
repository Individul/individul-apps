# Task Manager

Task manager de echipă (4-5 persoane), **100% Vercel-native**: Next.js + Supabase,
fără backend separat. Găzduire GitHub + Vercel.

## Funcționalități

- Listă/tabel de task-uri cu sortare și filtrare (după stare, prioritate, responsabil)
- Atribuire către membrii echipei
- Termene (due date) și prioritate (scăzută/medie/ridicată)
- Statusuri: De făcut / În lucru / Finalizat
- Etichete colorate (create doar de admin; utilizatorii le pot alege)
- Comentarii pe fiecare task (editare/ștergere doar de autor)
- Notificări în aplicație (clopoțel) cu actualizare în timp real
- Autentificare cu **email sau username + parolă**, **invite-only** (utilizatori adăugați manual în Supabase)
- Fiecare utilizator își poate seta numele afișat și username-ul („Profilul meu") și schimba parola din aplicație

## Navigare

Pagina de start (`/`) e un **hub**, cu câte un card pentru **Sarcini**,
**Petiții** și **Transferuri** — și cifre live: total, active (respectiv în
examinare), scadente în 7 zile și restante; la transferuri, care n-au
responsabil, plecați / sosiți / sold pe luna curentă. După autentificare
aterizezi tot pe `/`.

Toate paginile autentificate au un **antet comun**: link „Acasă", tab-urile
**Sarcini | Petiții | Ședințe | Transferuri | Statistici**, clopoțelul de
notificări și acțiunile de cont
(„Profilul meu", „Schimbă parola", „Deconectare"; adminii au în plus „Administrare"). Tabul
**Sarcini** rămâne activ și pe detaliul unei sarcini (`/tasks/[id]`). Detaliul
sarcinii și pagina de administrare au, sub antet, și un buton „Înapoi la
sarcini" (→ `/sarcini`).

| Rută          | Conținut                                 |
| ------------- | ---------------------------------------- |
| `/`           | hub — carduri de modul cu cifre live     |
| `/sarcini`    | lista de sarcini                         |
| `/petitii`    | registrul petițiilor                     |
| `/sedinte`    | evidența ședințelor de judecată          |
| `/transferuri`| registrul transferurilor                 |
| `/statistici` | rapoarte statistice importate din Excel  |
| `/tasks/[id]` | detaliul unei sarcini                    |
| `/admin`      | administrare (doar admin)                |

`/tasks` redirecționează la `/sarcini`, pentru linkuri și bookmark-uri vechi.

## Stack

- **Next.js 14.1** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui** (Radix)
- **TanStack Table** (tabelul principal)
- **Supabase** — Postgres + Auth, via `@supabase/ssr`
- **react-hook-form** + **zod** (formulare)
- **Vitest** (unit) + **Playwright** (E2E)

Autorizarea e impusă de baza de date prin Row-Level Security (RLS). Mutațiile se
fac prin Server Actions; citirile prin Server Components.

## Roluri

Există două roluri: **membru** (`member`) și **administrator** (`admin`).
Autorizarea e impusă de RLS + trigger-e în Postgres (vezi
[`supabase/migrations/0002_roles.sql`](supabase/migrations/0002_roles.sql)).

| Acțiune                        | Membru                          | Administrator            |
| ------------------------------ | ------------------------------- | ------------------------ |
| Creare task                    | doar pentru sine (auto-atribuit)| pentru oricine           |
| Reatribuire task (assignee)    | nu                              | da                       |
| Editare task                   | task-uri proprii                | orice task               |
| Ștergere task                  | doar task-uri proprii           | orice task               |
| Editare comentariu             | doar autorul                    | doar autorul             |
| Ștergere comentariu            | doar autorul                    | autorul **sau** admin    |
| Gestionare roluri (`/admin`)   | nu                              | da                       |

Administratorii au acces la pagina **[`/admin`](src/app/admin/page.tsx)** unde pot
promova/retrograda utilizatori între `member` și `admin` (nu-și pot schimba
propriul rol, ca să nu se retrogradeze accidental).

> Migrarea `supabase/migrations/0002_roles.sql` trebuie aplicată (după
> `0001_init.sql`) și primul admin setat manual — vezi
> [`supabase/README.md`](supabase/README.md#2b-roluri) pentru bootstrap.

> Pentru login cu username, aplică și `supabase/migrations/0003_username.sql`
> (după `0002_roles.sql`) — vezi [`supabase/README.md`](supabase/README.md#2c-username).

## Notificări

Fiecare utilizator are un **clopoțel** (dreapta-sus, în antetul comun) cu
notificările proprii și un contor de necitite. Deschis, afișează ultimele
notificări; la click pe una o marchează citită și navighează la task, iar
„Marchează toate citite" le marchează pe toate deodată.

Notificările se generează automat la:

- **atribuire** — un task ți-a fost atribuit;
- **comentariu** — comentariu nou pe un task;
- **stare** — s-a schimbat statusul unui task;
- **editare** — un task a fost modificat;
- **ștergere** — un task a fost șters.

Destinatari: **responsabilul** (assignee) și **creatorul** task-ului, mai puțin
autorul acțiunii (nu ești notificat pentru propriile acțiuni). La atribuire e
notificat doar noul responsabil.

Livrarea e **în timp real** prin Supabase Realtime (canal `postgres_changes` pe
tabelul `notifications`, filtrat pe `user_id`), deci clopoțelul se actualizează
fără reîncărcarea paginii.

> Migrarea [`supabase/migrations/0008_notifications.sql`](supabase/migrations/0008_notifications.sql)
> trebuie aplicată (după `0007_audit.sql`); ea adaugă și tabelul `notifications`
> la publicația `supabase_realtime`.

## Transferuri

Evidența transferurilor de deținuți între penitenciare. Un rând e **o zi + un
penitenciar + planificat/urgent** și ține ambele sensuri deodată: `plecati` (din
P-6 într-acolo) și `sositi` (de acolo la P-6). `total` e **coloană generată** în
Postgres, deci nu poate ajunge să nu corespundă cu cele două cifre din care iese,
indiferent cine scrie în tabelă.

Se înregistrează **cifre, nu nume**. Nu există rând per deținut, iar consecința
merită spusă pe față: **din totaluri nu se poate reveni la persoane.** „Unde a
fost transferat X" e o întrebare la care modulul acesta nu va răspunde niciodată,
nici măcar retroactiv — ar trebui pornit un registru nominal de la zero, iar
trecutul rămâne agregat. În schimb, niciun nume de deținut nu ajunge în baza de
date.

**Penitenciarul partener e un număr, nu text liber** — eticheta („Penitenciarul
nr. 3") se compune în cod, deci nimeni nu scrie „Penit. 3" într-o zi și „P-3" în
alta, iar sortarea e naturală. Constrângerea din bază
(`institution between 1 and 18 and institution not in (6, 14)`) spune două lucruri
deodată: **nr. 6 suntem noi**, deci nu te transferi la tine însuți, iar **nr. 14
nu există**. Rămân 16 instituții.

Transferurile sunt programate în **prima și a treia zi de luni** din lună.
Aplicația le calculează singură, prin funcții pure — nu există un calendar de
întreținut. Din același calcul ies toate cele trei comportamente: tipul
„planificat" propus în formular când ziua aleasă e o luni programată, data
următorului transfer, și semnalarea unei zile programate rămase necompletate.
Golul e informația care nu se vede altundeva: o zi necompletată n-ar apărea
nicăieri în registru.

Ziua lipsă se semnalează însă **abia după ce s-a încheiat**, nu în timp ce se
desfășoară: pe 6 iulie la ora 9 transferul de pe 6 iulie e încă în curs, iar o
avertizare atunci ar fi o alarmă falsă. Semnalate degeaba, avertizările ajung
ignorate și în zilele când chiar lipsește ceva.

Pagina (`/transferuri`) are, pentru perioada aleasă: **trei cifre** — plecați,
sosiți, sold (sosiți − plecați) —, avertizarea de mai sus cu data următorului
transfer, și **registrul pe zile** în ordine inversă, cu un antet per zi și câte
un rând per penitenciar dedesubt.

Câteva alegeri de citit în pagină:

- Plecările și sosirile se disting prin **săgeți care diferă ca direcție, nu doar
  ca culoare** (↑ plecați, ↓ sosiți): cine nu distinge roșul de verde citește
  corect după formă.
- Unde nu s-a mișcat nimeni se scrie **„—", nu 0** — lipsa mișcării și mișcarea
  de zero valori sunt lucruri diferite. Soldul face excepție: pe o perioadă cu
  rânduri, 0 înseamnă „au venit câți au plecat".
- Un rând cu 0 și 0 rămâne valid. Pe o zi programată în care n-a mișcat nimeni e
  singurul fel de a spune că ziua a avut loc — altfel ar fi raportată ca lipsă.

Drepturile sunt ca la ședințe, din același motiv: oricine autentificat citește și
completează, altfel un coleg n-ar putea corecta ziua introdusă de altul.
Ștergerea unui rând e doar a adminului (impusă prin RLS, nu doar în interfață).
Cine a scris rămâne în jurnalul de audit de la `/admin`, sub modulul
**Transferuri**.

> Migrarea [`supabase/migrations/0020_transfers.sql`](supabase/migrations/0020_transfers.sql)
> trebuie aplicată (după `0019`) — până atunci modulul nu funcționează. Creează
> tabelul `transfers` cu RLS și adaugă ramura de transferuri în trigger-ul de
> audit.

## Statistici

Rapoartele statistice se completează în continuare în Excel, ca până acum.
Aplicația le **importă**, păstrează **istoricul** și arată **evoluția în timp**.
Se extrag doar datele penitenciarului **P-6**.

Pagina are **o secțiune per raport**, fiecare cu graficele potrivite conținutului
lui — forma urmează întrebarea, nu invers:

| Raport | Întrebarea | Formă |
| --- | --- | --- |
| Populație | cum evoluează numărul de deținuți? | linie, cu plafonul ca reper punctat |
| Liberări | din ce se compune totalul? | inel (sau bare, peste 6 motive) + linie în timp |
| Comisia | art. 91 față de art. 92 | bare grupate |
| Grațiere | ce s-a întâmplat cu demersurile? | bare |
| Ședințe | teleconferință față de instanță | bare grupate |
| Mecanism compensatoriu | cum evoluează? | două linii separate (persoane / termen) |
| Amnistii | structura pe articole | bare orizontale |

Fiecare secțiune are dedesubt **„Toate valorile"** — un tabel pliabil cu tot ce
s-a importat pentru perioadă. Prezentarea aleasă nu ascunde niciodată date.

Reguli de afișare care merită știute:

- Indicatorii care sunt **0 în toate perioadele** nu apar în grafice (rapoartele
  au zeci de rânduri care nu s-au întâmplat niciodată); rămân în „Toate valorile".
- O valoare lipsă **rămâne lipsă** — linia se întrerupe, nu se completează cu 0.
- Totalurile nu apar niciodată într-un grafic de compoziție, ca să nu stea totalul
  ca felie lângă propriile lui părți.
- „Suprapopularea" negativă se citește ca **locuri libere** (−5 → „Locuri libere 5").

Tipuri de raport recunoscute (detectate automat din conținut):

| Tip | Conținut |
| --- | --- |
| Raport lunar | plafon de detenție, deținuți, suprapopulare, femei, minori, liberați |
| Liberări | liberări pe motive, decedați |
| Comisia penitenciară | art. 91 / 92 CP — examinați, admiși, refuzați, expediați în judecată |
| Grațiere | demersuri, examinați, grațiați, refuzați |
| Amnistia 2016 / Amnistia 2021 | aplicarea legilor de amnistie |
| Mecanism compensatoriu | reduceri de termen (art. 473/2 CPP) |
| Ședințe de judecată | teleconferință, sediu, instanță, amânate |

**Fluxul de import** (doar admin): alegi fișierul `.xlsx` → aplicația detectează
tipul și propune perioada din numele fișierului → **previzualizezi** toți
indicatorii extrași → confirmi perioada (dată + săptămânal/lunar) → se salvează.
Fișierul original rămâne într-un bucket privat și se poate redeschide oricând.

Câteva alegeri deliberate:

- **Perioada se confirmă manual.** Datele din fișiere sunt contradictorii (un
  fișier are „30.06.2023" în titlu și 31.03.2024 în celula alăturată), deci
  ghicirea ar produce un istoric fals fără ca cineva să observe.
- **Tipul detectat poate fi schimbat.** Dacă alegi alt tip, fișierul e recitit cu
  el, așa că previzualizarea arată mereu exact ce se va salva.
- **Reimportul aceleiași perioade înlocuiește** datele, nu le dublează.
- Rapoartele cu **sub-rând de perioadă** (comisia, mecanism compensatoriu) se
  salvează pe două serii: `cumulat` și `perioada`.
- Localizarea coloanei/rândului P-6 se face **după text**, nu după coordonate, ca
  o inserare de rând în Excel să nu strice importul. Un fișier nerecunoscut dă
  eroare explicită, nu import tăcut greșit.

Vizualizarea e pentru toți utilizatorii; importul și ștergerea, doar pentru admini
(impus prin RLS, nu doar în interfață).

> Migrarea [`supabase/migrations/0016_statistics.sql`](supabase/migrations/0016_statistics.sql)
> trebuie aplicată (după `0015`); ea creează bucket-ul privat `statistics` și
> tabelele `stat_reports` / `stat_values`.

## Dezvoltare locală

1. Instalează dependențele:
   ```bash
   cd apps/task-manager && npm install
   ```
2. Copiază `.env.example` → `.env.local` și completează:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
   (din Supabase → Project Settings → API)
3. Pornește dev server-ul:
   ```bash
   npm run dev
   ```
   → http://localhost:3006
4. Teste:
   ```bash
   npm test          # unit (Vitest)
   npm run test:e2e  # E2E (vezi e2e/README.md)
   ```

## Setup Supabase

Detalii complete în [`supabase/README.md`](supabase/README.md). Pe scurt:

1. Creează un proiect pe [supabase.com](https://supabase.com).
2. În SQL Editor rulează [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. Activează providerul Email (Authentication → Providers → Email → *Enable Email
   provider* ON; logarea cu parolă e activă implicit) și lasă *Enable email signups*
   **OFF** — invite-only. Logarea userilor existenți cu parolă funcționează și cu
   signups off.
4. Adaugă cei 4-5 membri din Authentication → Users și **setează-le o parolă**
   (Add user → cu parolă + „Auto Confirm User"). Userii își pot schimba ulterior
   parola din aplicație („Schimbă parola", dreapta-sus în antetul comun).

## Deploy pe Vercel

1. Push branch-ul pe GitHub; importă repo-ul `individul-apps` în Vercel.
2. **Root Directory: `apps/task-manager`**. Framework: Next.js (detectat automat).
3. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. În Supabase → Authentication → URL Configuration adaugă domeniul Vercel la
   Redirect URLs (`https://<app>.vercel.app/auth/callback`).
5. Push pe `main` → deploy automat.

### Regiunea funcțiilor

`vercel.json` fixează `"regions": ["fra1"]` — Frankfurt. Nu e o preferință
estetică: baza de date Supabase a proiectului stă în `eu-central-1`, tot
Frankfurt. Regiunea implicită a Vercel e `iad1` (Washington), iar cu ea fiecare
interogare traversa Atlanticul de două ori.

Măsurat pe `/auth/callback` — o funcție Node care nu atinge baza de date —
costul invocării peste o redirecționare tratată la edge era **~134 ms din
Washington** și e **~66 ms din Frankfurt** (mediana a 12 cereri). Peste asta se
adaugă ~90 ms pentru fiecare citire din Supabase, care din Frankfurt dispar
aproape complet. Câștigul acela nu se vede în măsurătoarea de mai sus, fiindcă
endpointul ales nu interoghează nimic — se vede pe paginile reale.

Dacă vreodată se mută proiectul Supabase în altă regiune, **mută și asta odată
cu el**. Codul și baza de date trebuie să stea în același oraș.

## Structură

```
apps/task-manager/
├── src/
│   ├── app/
│   │   ├── login/           # pagină login (email + parolă)
│   │   ├── account/         # schimbare parolă (Server Action)
│   │   ├── auth/            # callback + signout (Route Handlers)
│   │   ├── sarcini/         # lista de sarcini
│   │   ├── petitii/         # registrul petițiilor + actions.ts
│   │   ├── tasks/           # [id] detaliu, actions.ts; /tasks → redirect /sarcini
│   │   ├── admin/           # administrare (doar admin)
│   │   ├── layout.tsx
│   │   └── page.tsx         # hub (carduri de modul cu cifre live)
│   ├── components/
│   │   ├── ui/             # componente shadcn/ui
│   │   ├── layout/         # antetul comun + tab-urile de modul
│   │   ├── hub/            # cardul de modul de pe pagina de start
│   │   ├── petitions/      # listă + formular petiții
│   │   └── tasks/          # tabel, formular, detaliu, etichete, comentarii
│   ├── lib/
│   │   ├── supabase/       # clienți server/browser + middleware
│   │   ├── queries.ts      # citiri Supabase
│   │   ├── schemas.ts      # zod
│   │   ├── types.ts
│   │   ├── task-filters.ts # helper-e filtrare/sortare (testate)
│   │   ├── hub-stats.ts    # cifrele de pe hub (testate)
│   │   └── permissions.ts  # helper permisiuni (testat)
│   └── middleware.ts       # refresh sesiune + protecție rute
├── supabase/
│   ├── migrations/0001_init.sql
│   └── README.md
└── e2e/                    # teste Playwright
```
