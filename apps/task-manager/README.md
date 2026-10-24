# Task Manager

Aplicația de lucru a secției (4-5 persoane), la
[sarcini.dumitru.cloud](https://sarcini.dumitru.cloud): sarcini, petiții,
ședințe, transferuri, preveniți și inculpați, contravenienți, informări
periodice și raportul de marți. Din 24.10.2026 rulează pe **Cloudflare**: un
Worker (Next.js prin OpenNext), baza de date D1 și fișierele în R2, cu logare
proprie. Până atunci a stat pe Vercel + Supabase; mutarea e descrisă în
[`docs/cloudflare-plan.md`](docs/cloudflare-plan.md).

## Funcționalități

- Listă/tabel de task-uri cu sortare și filtrare (după stare, prioritate, responsabil)
- Atribuire către membrii echipei
- Termene (due date) și prioritate (scăzută/medie/ridicată)
- Statusuri: De făcut / În lucru / Finalizat
- Etichete colorate (create doar de admin; utilizatorii le pot alege)
- Comentarii pe fiecare task (editare/ștergere doar de autor)
- Notificări în aplicație (clopoțel), verificate la fiecare jumătate de minut
- Autentificare cu **username sau adresă + parolă**, doar pentru conturi create de admin (nu există înscriere)
- Fiecare utilizator își poate seta numele afișat și username-ul („Profilul meu") și schimba parola din aplicație

## Navigare

Pagina de start (`/`) e un **hub**, cu câte un card pentru **Sarcini**,
**Petiții** și **Transferuri** — și cifre live: total, active (respectiv în
examinare), scadente în 7 zile și restante; la transferuri, care n-au
responsabil, plecați / sosiți / sold pe luna curentă. După autentificare
aterizezi tot pe `/`.

Toate paginile autentificate au un **antet comun**: link „Acasă", tab-urile
modulelor, clopoțelul de notificări și meniul de cont („Profilul meu",
„Schimbă parola", „Deconectare"; adminii au în plus „Administrare"). Tabul
**Sarcini** rămâne activ și pe detaliul unei sarcini (`/tasks/[id]`).

| Rută | Conținut |
| --- | --- |
| `/` | hub — carduri de modul cu cifre live, căutare în toate registrele |
| `/sarcini` | lista de sarcini |
| `/tasks/[id]` | detaliul unei sarcini |
| `/petitii` | registrul petițiilor |
| `/sedinte` | evidența ședințelor de judecată |
| `/transferuri` | registrul transferurilor; `/transferuri/planificare` — planificarea |
| `/inculpati` | preveniți și inculpați |
| `/contravenienti` | contravenienții |
| `/obligatii` | informările periodice |
| `/raport-saptamanal` | raportul de marți (ecran, PDF, tipar) |
| `/admin` | administrare: conturi, roluri, jurnal, copie (doar admin) |
| `/fisiere/…` | fișierele petițiilor, servite din R2 după verificarea sesiunii |
| `/versiune` | versiunea Worker-ului, pentru anunțul „Aplicația a fost actualizată" |

`/tasks` redirecționează la `/sarcini`, pentru linkuri și bookmark-uri vechi.

## Stack

- **Next.js 15** (App Router) + **React 19** + TypeScript, pe **Cloudflare
  Workers** prin [OpenNext](https://opennext.js.org/cloudflare)
- **D1** (SQLite) prin **Drizzle ORM**; fișierele în **R2**
- Logare proprie: parole bcrypt, sesiuni ținute în D1 (`src/lib/auth/`)
- **Tailwind CSS** + **shadcn/ui** (Radix), **TanStack Table**
- **react-hook-form** + **zod** (formulare)
- **Vitest**, cu teste pe un D1 adevărat (`getPlatformProxy` din wrangler)

Mutațiile se fac prin Server Actions, citirile prin Server Components. Fiecare
acțiune își cere singură sesiunea: Next permite chemarea unei acțiuni printr-un
POST la orice cale, deci o pagină protejată nu apără acțiunile ei.

## Roluri

Există două roluri: **membru** (`member`) și **administrator** (`admin`).
Regulile, mutate din politicile RLS ale Postgres, stau în
[`src/lib/acl.ts`](src/lib/acl.ts) și sunt aplicate de modulele din
`src/lib/data/`, unde sunt și testate. Jurnalul pe care îl scriau triggerele îl
scrie acum [`src/lib/audit.ts`](src/lib/audit.ts), în aceeași tranzacție cu
schimbarea.

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

Clopoțelul întreabă serverul la fiecare **30 de secunde** și la întoarcerea în
fereastra aplicației, deci o notificare nouă apare cu cel mult o jumătate de
minut întârziere. (Pe Supabase sosea pe loc, prin Realtime; pe Cloudflare nu
există un asemenea canal, iar întârzierea e neglijabilă pentru ce anunță.)
Când o verificare pică după o publicare nouă, clopoțelul compară versiunea
Worker-ului (`/versiune`) și cere reîncărcarea paginii.

## Transferuri

Evidența transferurilor de deținuți între penitenciare. Un rând e **o zi + un
penitenciar + planificat/urgent** și ține ambele sensuri deodată: `plecati` (din
P-6 într-acolo) și `sositi` (de acolo la P-6). `total` e **coloană generată** în
bază, deci nu poate ajunge să nu corespundă cu cele două cifre din care iese,
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
Ștergerea unui rând e doar a adminului (impusă pe server, nu doar în interfață).
Cine a scris rămâne în jurnalul de audit de la `/admin`, sub modulul
**Transferuri**.

## Statistici

Modulul de statistici nu mai e aici: din 1 octombrie 2026 stă în aplicația lui,
la [statistici.dumitru.cloud](https://statistici.dumitru.cloud) (depozitul
`Individul/statistici`), unde dările de seamă se preiau singure din Cloud
Fișiere, fără încărcare de mână.

Tabelele `stat_reports` / `stat_values` și bucket-ul `statistics` au rămas în
Supabase și nu au fost mutate pe Cloudflare; datele lor stau în copiile de
dinainte de 24.10.2026.

## Raportul săptămânal

În fiecare marți dimineața se informează conducerea despre săptămâna încheiată.
Patru cifre, atât: **plecați, sosiți, teleconferințe, eliberați**. Se adunau de
mână din trei locuri, iar a patra nu exista nicăieri în aplicație. Pagina
[`/raport-saptamanal`](src/app/raport-saptamanal/page.tsx) le adună singură, le
arată în forma în care se predau și le scoate din aplicație în două feluri:
**„Descarcă PDF"** (fișier `raport-AAAA-LL-ZZ.pdf`, desenat pe server) sau
**„Tipărește"** (dialogul browserului, cu antetul aplicației și zonele de
completare scoase din pagină).

Se intră din butonul **„Raportul de marți"**, de lângă salutul de pe pagina de
start. Nu are tab în antet, dinadins: nu e un registru în care se lucrează, ci
hârtia unei singure dimineți. Nu se trimite pe email și nu se generează
programat — raportul se prezintă, nu se expediază, iar o rulare automată ar
produce fișiere pe care nu le citește nimeni.

### Săptămâna e marți → luni, nu luni → duminică

**Marțea în care se prezintă raportul aparține săptămânii următoare**, nu celei
raportate. Regula pare arbitrară până se scrie alternativa: cu marțea inclusă,
aceeași zi ar intra în două rapoarte consecutive, iar un transfer de marți s-ar
număra de două ori. În plus, dimineața raportului ar depinde de date care abia
se întâmplă — ședințele zilei nu sunt introduse la ora 9.

Deschisă în orice zi, pagina arată aceeași ultimă săptămână încheiată; nici luni
nu trece la săptămâna în curs, fiindcă ziua curentă nu s-a terminat. Înapoi se
poate naviga oricât; înainte de săptămâna curentă, nu — acolo n-ar fi un raport,
ci șapte zile care încă nu s-au întâmplat, adică patru zerouri pe care nici
avertizarea de zile lipsă nu le-ar semnala, fiindcă o zi viitoare nu poate
„lipsi".

Calculul stă în [`src/lib/weekly-report.ts`](src/lib/weekly-report.ts), verificat
pe fiecare zi a unei luni întregi — regula „ziua curentă nu s-a încheiat" e ușor
de stricat la o rescriere —, și e citit deopotrivă de pagină și de ruta de PDF.
Două normalizări scrise separat s-ar despărți la prima corectură, iar
despărțirea n-ar arăta a defect: butonul de descărcare ar întoarce liniștit un
raport pe altă săptămână decât cea de pe ecran, cu cifre perfect corecte pentru
intervalul greșit. Tot prin funcția aceea (`readWeek`) trece și adresa
`?saptamana=`: dacă parametrul apare de mai multe ori se ia prima valoare, la
fel în ambele locuri, iar o zi care nu există — „2026-02-30", pe care șablonul
AAAA-LL-ZZ nu are cum s-o prindă — se respinge, în loc să fie rostogolită tăcut
de motorul JavaScript în luna următoare.

**„Azi" înseamnă ziua de la Chișinău, nu ziua de pe ceasul serverului.** Funcția
Worker-ului merge pe UTC, iar noi suntem înaintea lui cu două ore iarna și cu
trei vara: între miezul nopții de aici și cel de la Greenwich serverul e încă în
ziua de ieri. Deschis marți la ora 2 dimineața, raportul arăta săptămâna
dinainte — patru cifre perfect corecte pentru intervalul greșit, sub un subsol
datat cu ziua de azi. Ziua calendaristică se ia acum cu `todayInChisinau()` din
[`src/lib/periods.ts`](src/lib/periods.ts), prin `Intl` și nu adunând un decalaj
fix, fiindcă Moldova ține ora de vară. Testele rulează pe UTC
([`vitest.config.ts`](vitest.config.ts)) tocmai ca greșeala asta să poată cădea:
mașinile de dezvoltare stau pe Europe/Bucharest, care are exact același decalaj
ca Chișinăul tot anul, deci local ziua citită greșit coincide cu cea corectă.

### De unde vin cele patru cifre

| Cifra | Sursa |
| --- | --- |
| Plecați / Sosiți | registrul de transferuri, zilele din interval |
| Teleconferințe | `hearings.tc_total`, cu amânatele scrise mic dedesubt |
| Eliberați | registrul de eliberări, completat chiar pe pagină |

**Teleconferințele sunt petrecute + amânate.** Cifra cerută de conducere e
totalul, iar el există deja: `tc_total` e **coloană generată** în bază
(`tc_petrecute + tc_amanate`, în `migrations/0000_init.sql`), deci se citește, nu se
recompune — nu poate ajunge să nu corespundă cu cele două cifre din care iese,
indiferent cine scrie în tabelă. Amânatele apar totuși separat, cu corp mic, sub
total: un total care nu spune din ce se compune ridică întrebarea chiar în
dimineața în care nu vrei s-o auzi.

**Eliberările sunt un registru nou**, fiindcă cifra asta nu se ținea minte
nicăieri: un rând pe zi — ziua, câți și o observație opțională —, completat
într-o zonă a paginii care nu se tipărește. Alternativa, un câmp lăsat gol pe
hârtie și scris de mână marți dimineața, a fost respinsă: cifra n-ar rămâne
nicăieri, n-ar putea fi verificată retroactiv, iar dacă cine completează nu știe
numărul exact la ora aceea, întârzie tot raportul. Nu primește tab propriu; două
câmpuri o dată pe săptămână nu fac un modul. Ziua necompletată se vede „—", iar
ziua verificată în care n-a ieșit nimeni se vede „0" — sunt lucruri diferite și
se scriu diferit. Din același motiv **câmpul golit se respinge, nu se salvează
ca 0**: `Number("")` e chiar 0, deci fără verificarea aceea ștergerea cifrei ar
face în tăcere cea mai tare dintre cele două afirmații. Drepturile sunt ca la
ședințe și transferuri: oricine
autentificat citește și completează, ștergerea e a adminului (pe server, nu doar
în interfață), iar corecturile rămân în jurnalul de la `/admin`, sub modulul
**Eliberări** — un „3 → 5" scris explicit, fiindcă altfel numărul vechi ar
dispărea odată cu suprascrierea.

Toate patru ies din aceeași funcție (`weeklyFigures`), folosită și de ecran și
de PDF. A doua socoteală, oriunde ar fi scrisă, se desincronizează de prima la
prima modificare — s-a mai întâmplat în proiectul ăsta, cu restanțele: „8"
într-un loc, „1" în altul, aceeași zi. O hârtie tipărită care nu se potrivește
cu ecranul e mai rea decât lipsa raportului.

Raportul spune și ce nu știe, **inclusiv pe hârtie**:

- **zilele lucrătoare fără ședințe introduse** se enumeră deasupra butoanelor de
  export, cu link spre completare: teleconferințele numără doar zilele
  introduse, iar o cifră incompletă, o dată tipărită, nu se mai retrage;
- **„—", nu 0**, când registrul eliberărilor nu poate fi citit. Un zero arată
  exact ca o săptămână în care n-a ieșit nimeni, iar celelalte trei cifre fiind
  corecte, nimeni n-ar avea motiv să se îndoiască tocmai de a patra.


### Fontul din `src/fonts` — nu-l șterge, nu-l subseta

Două fișiere binare de ~430 KB fiecare, într-un repo de cod, plus un fișier de
licență. Arată exact ca ceva rămas uitat acolo. Nu sunt, iar motivul e scris
aici tocmai fiindcă altfel dispar la prima curățenie:

**Cele paisprezece fonturi standard din PDF nu conțin ș, ț și ă.** Codificarea
lor se oprește la Latin-1, iar literele astea sunt în Latin Extended. Fără un
font încorporat în document, „Ședințe" iese „Sedinte" sau cu pătrate — și nu un
cuvânt, ci aproape fiecare cuvânt al raportului: Plecați, Sosiți, Eliberați,
Date statistice. De aceea Noto Sans e adus în proiect, o dată, cu licența (SIL
Open Font License 1.1) alături, în [`src/fonts/OFL.txt`](src/fonts/OFL.txt) —
licența cere ca ea să însoțească fontul.

**Fontul se încorporează întreg. Nu adăuga `{ subset: true }`.** Un PDF de o
pagină iese pe la 500 KB, aproape numai font, deci subsetarea e primul lucru pe
care cineva va vrea să-l optimizeze. Subsetarea din `@pdf-lib/fontkit` strică
exact literele pentru care a fost adus fontul: glifele compuse — literă + semn,
adică ă, ș, ț, î — rămân fără componentele lor, iar cititorul de PDF le sare.
Încercat, nu presupus: cu subsetare pornită, titlul „Date statistice" se tipărea
**„Da s a s"**.

Ce face capcana serioasă e că **greșeala nu se vede din afara fișierului**:
textul extras din PDF rămâne corect, deci orice verificare automată pe conținut
trece verde. Doar desenul e găurit. Singurul test care o prinde e deschiderea
fișierului cu ochii — și el nu poate rula în CI, deci după orice atingere a
generării PDF-ului descarcă un raport și uită-te la diacritice. Detaliile stau
lângă `embedFont`, în
[`src/app/raport-saptamanal/pdf/route.ts`](src/app/raport-saptamanal/pdf/route.ts).

Fonturile intră în pachetul Worker-ului, ca text base64, prin regula `.ttf`
din [`next.config.mjs`](next.config.mjs). Pe Workers nu există disc, deci
citirea de pe disc la fiecare cerere, cum se făcea pe Vercel, nu mai e posibilă.
Costul e cam 1,1 MB în pachet, din cei 10 MB permiși.

## Dezvoltare locală

1. Dependențele:
   ```bash
   cd apps/task-manager && npm ci
   ```
2. Baza locală (D1 simulat de wrangler, în `.wrangler/`):
   ```bash
   npx wrangler d1 migrations apply sarcini --local
   ```
   Baza nouă nu are conturi. Un cont local se pune cu un `INSERT` în `users`
   (cu amprenta bcrypt a parolei, `bcryptjs.hashSync(parola, 10)`) și unul în
   `profiles`, cu același `id` și `role = 'admin'`; de acolo, restul conturilor
   se creează din `/admin`.
3. Pornirea:
   ```bash
   npm run dev       # next dev, http://localhost:3006, cu D1 și R2 locale
   npm run preview   # build-ul de Worker, rulat local ca în producție
   ```
   Aplicația nu are nevoie de variabile de mediu: legăturile (D1, R2, limita
   de logare) vin din [`wrangler.toml`](wrangler.toml). Pentru copia de noapte
   rulată local, jetonul GitHub se pune în `.dev.vars` (`BACKUP_GITHUB_TOKEN=…`),
   care nu se comite.
4. Verificările dinainte de orice push:
   ```bash
   npx tsc --noEmit && npm run lint && npm test && npm run build && npm run build:cf
   ```

## Publicare

Un push pe `main` publică singur, prin **Workers Builds** (Cloudflare → Workers →
`sarcini` → Settings → Builds): rădăcina `apps/task-manager`, build
`npx opennextjs-cloudflare build`, deploy `npx opennextjs-cloudflare deploy`.
Se construiește doar când se schimbă ceva sub `apps/task-manager/`, fără
fișierele `.md`, `supabase/` și `e2e/`: altfel orice push în depozit republica
aplicația. Publicarea se vede în check-run-ul „Workers Builds: sarcini" al
commit-ului sau cu `npx wrangler deployments list --name sarcini`.

La fiecare build, Next schimbă identificatorii acțiunilor de server. O filă
deschisă dinainte primește atunci 404 la salvare; clopoțelul observă și cere
reîncărcarea paginii.

**Schimbări de schemă:** se modifică [`src/lib/db/schema.ts`](src/lib/db/schema.ts),
`npx drizzle-kit generate` scrie migrarea în `migrations/`, apoi
`npx wrangler d1 migrations apply sarcini --remote`, **înainte** de push-ul
codului care o folosește.

**Secrete:** singurul e `BACKUP_GITHUB_TOKEN`, pus cu
`npx wrangler secret put BACKUP_GITHUB_TOKEN`. Variabilele obișnuite
(`BACKUP_MODE`, `GITHUB_BACKUP_REPO`) stau în `wrangler.toml`.

**Unde stă:** D1 e în regiunea `eeur` (Europa de Est), iar Worker-ul rulează în
centrul Cloudflare cel mai apropiat de cine deschide pagina — pentru Chișinău,
de obicei Chișinău sau Kiev.

## Copie de siguranță

O copie care se oprește în tăcere e mai rea decât lipsa uneia: te crezi acoperit
tocmai când nu ești. De aceea fiecare rulare lasă urmă în `backup_runs`, iar
starea copiei se vede pe `/admin`, sub titlu — fără s-o caute cineva.

### Ce acoperă Cloudflare și ce nu

- **D1 Time Travel** readuce baza la orice minut din **ultimele 30 de zile**
  (pe planul Workers Paid), cu `npx wrangler d1 time-travel restore`.
- **R2 nu are versiuni.** Un fișier șters sau suprascris nu se mai întoarce din
  Cloudflare. Singura lui copie e cea de mai jos.

### Ce face copia noastră

În fiecare noapte, cronul Worker-ului (`0 2 * * *` și `30 2 * * *` UTC; a doua
rulare e plasa pentru o primă rulare căzută și iese imediat dacă prima a reușit)
cheamă copia direct, din handlerul `scheduled` din [`worker.ts`](worker.ts).
Nu există o rută de apărat. Copia scrie într-un **repo privat pe GitHub**
(`GITHUB_BACKUP_REPO`):

- **baza de date**, toate tabelele, într-un fișier pe zi (`db/2026-10-25.json`).
  Fiindcă e versionat de git, se poate reveni la starea de acum trei luni, nu
  doar la ultimele 30 de zile;
- **fișierele petițiilor** din R2, sub `files/petitions/…`, plus
  `manifest.json` — evidența celor deja salvate.

**Fișierele se copiază o singură dată.** Un scan se încarcă și nu se mai schimbă,
deci fiecare noapte urcă doar ce e nou față de manifest — cel mult **15 fișiere**
pe rulare; restul așteaptă noaptea următoare. „Încă N fișiere de copiat", pe
`/admin`, e normal cât timp cifra scade de la o zi la alta.

**Ce nu se copiază, dinadins:** conturile (`users`, cu amprentele parolelor) și
sesiunile. Parolele n-au ce căuta într-un repo, nici măcar ca amprente. Sunt
patru-cinci oameni; la o restaurare de la zero conturile se creează din nou.

Butonul **„Rulează copia acum"** de pe `/admin` face exact aceeași copie, pe loc.
Același cron, la fiecare rulare, șterge și sesiunile expirate.

### Când ceva nu merge

Banda de pe `/admin` spune ce s-a întâmplat la ultima rulare, iar motivul apare
sub ea. Întregul e în jurnalul Worker-ului: Cloudflare → Workers → `sarcini` →
Observability, unde fiecare rulare scrie o linie `{"backup": …}`. Cele mai
frecvente: **401** — jetonul a expirat sau e greșit; se înlocuiește cu
`npx wrangler secret put BACKUP_GITHUB_TOKEN`. **404** — `GITHUB_BACKUP_REPO`
e greșit **sau** jetonul n-are acces la exact acel repo, fiindcă GitHub răspunde
tot 404 când accesul lipsește. Jetonul e un fine-grained token cu drept
„Contents: Read and write" doar pe repo-ul copiei; are termen de expirare,
deci merită notat.

### Restaurarea

**Ultimele 30 de zile:** D1 Time Travel. Întâi se află marcajul momentului
dorit, apoi se restaurează; restaurarea înlocuiește toată baza, deci ce s-a
scris după acel moment se pierde:

```bash
npx wrangler d1 time-travel info sarcini --timestamp=2026-10-25T08:00:00+03:00
npx wrangler d1 time-travel restore sarcini --timestamp=2026-10-25T08:00:00+03:00
```

**Mai vechi de 30 de zile, sau o bază nouă:** din `db/<zi>.json`. Fișierul are
`counts` — câte rânduri avea fiecare tabel — și `data`, cu rândurile. Cheile din
`data` sunt în **ordinea cheilor străine**, părintele înaintea copilului, deci
se inserează de sus în jos. Pe o bază nouă se aplică întâi migrările
(`npx wrangler d1 migrations apply sarcini --remote`), se creează conturile
**cu id-urile din `data.profiles`** (altfel nimic nu mai arată spre ele), apoi
fiecare tabel se transformă în `INSERT OR IGNORE`, fără coloanele generate
(`petitions.response_deadline`, totalurile de la ședințe și transferuri), și se
rulează cu `npx wrangler d1 execute sarcini --remote --file=…`. La final se
compară numărătorile cu `counts`. Nu există un buton pentru asta, dinadins: cine
restaurează e de obicei un om speriat, iar un buton apăsat în panică peste date
bune e mai periculos decât lipsa lui. („Restaurează din backup", de pe `/admin`,
acoperă doar formatul vechi, cu patru tabele.)

**Fișierele:** din repo-ul copiei, `files/petitions/<cale>` se urcă înapoi în R2
(`sarcini-fisiere`) **pe aceeași cale** —
`npx wrangler r2 object put sarcini-fisiere/<cale> --file=… --remote`. Rândurile
din `petition_attachments` țin calea, deci un fișier urcat altundeva nu se mai
deschide din aplicație.

### Peretele de peste ani

`manifest.json` crește cu ~120 de baiți la fiecare fișier salvat, iar Contents API
trimite conținutul inline doar sub **1 MB**. Undeva la **8–10 mii de fișiere**
manifestul trece pragul, iar copia se oprește cu o eroare limpede („…n-are conținut
inline. Ori calea arată spre un director, ori fișierul trece de 1 MB"). La ritmul de
acum sunt ani până acolo, dar peretele e real și e scris aici ca cel care-l atinge
să nu caute o defecțiune inexistentă: atunci manifestul trebuie spart în bucăți
(unul pe bucket, sau pe an), nu reparat.


## Structură

```
apps/task-manager/
├── worker.ts               # intrarea Worker-ului: Next (OpenNext) + cronul copiei
├── wrangler.toml           # legăturile: D1, R2, limita de logare, rute, cron
├── migrations/             # schema D1 (generată de drizzle-kit)
├── src/
│   ├── app/                # paginile și acțiunile de server (`actions.ts`)
│   │   ├── login/          # logarea (username sau adresă + parolă)
│   │   ├── fisiere/        # fișierele petițiilor, din R2
│   │   ├── versiune/       # versiunea Worker-ului
│   │   └── error.tsx       # plasa pentru erorile din pagină
│   ├── components/         # interfața, pe module; `ui/` — shadcn/ui
│   ├── lib/
│   │   ├── auth/           # parole, sesiuni, logare
│   │   ├── db/             # schema Drizzle, legătura D1, baza de test
│   │   ├── data/           # scrierile, pe module, cu drept și jurnal (testate)
│   │   ├── acl.ts          # cine ce are voie
│   │   ├── audit.ts        # jurnalul, cu aceleași detalii ca triggerele vechi
│   │   ├── sigur.ts        # plasa acțiunilor pentru erorile neprevăzute
│   │   ├── queries.ts      # citirile paginilor
│   │   └── backup-*.ts     # copia de noapte
│   └── middleware.ts       # sesiunea: verificare, prelungire, redirecționare
├── docs/cloudflare-plan.md # mutarea de pe Vercel + Supabase și drumul înapoi
└── supabase/               # istoricul de pe Supabase (migrări vechi), până la oprire
```
