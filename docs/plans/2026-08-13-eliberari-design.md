# Modulul Eliberări — design

**Data:** 13 august 2026
**Stare:** aprobat de utilizator, gata de plan de implementare

## Problema

Eliberările se pregătesc din timp, dar nu există nicăieri o listă cu numele
oamenilor care ies luna asta. Cifra lunară există — se introduce de mână pentru
raportul de marți, în tabelul `releases` — însă o cifră nu-ți spune pe cine ai de
pregătit joi dimineață.

Responsabilă de eliberări este Ana Cojocari. Ea are nevoie de două lucruri: să
vadă luna dintr-o privire, fără să deschidă nimic, și să fie anunțată în ziua în
care cineva se eliberează.

## Ce se construiește

Un registru nominal nou, un chenar pe pagina de start, o sub-pagină și un anunț
zilnic. Registrul de cifre rămâne neatins.

### 1. Tabelul `release_plans`

Nominal, separat de `releases`. Sunt două lucruri diferite: unul e cifra
raportată conducerii, celălalt e lista de lucru.

| Coloană | Tip | Rol |
| --- | --- | --- |
| `id` | uuid | |
| `last_name`, `first_name` | text | numele deținutului |
| `release_date` | date | ziua eliberării |
| `ground` | text + CHECK | temeiul, din lista de mai jos |
| `note` | text, nullable | text liber |
| `done` | boolean | s-a eliberat efectiv |
| `notified_at` | timestamptz, nullable | când a plecat anunțul |
| `created_by`, `updated_by` | uuid | audit |
| `created_at`, `updated_at` | timestamptz | audit |

Fără constrângere de unicitate: doi oameni se pot elibera în aceeași zi cu
același temei, iar omonimele există.

RLS ca la celelalte registre — membrii secției citesc și scriu, ștergerea la fel
ca la planificarea transferurilor. Declanșator de audit propriu, cu funcție
separată, nu o ramură nouă în `record_audit()` — aceeași hotărâre ca la
`transfer_plans` și `releases`.

### 2. Cele nouăsprezece temeiuri

Luate din `LIBERATI_MOTIVE` (`src/lib/stats/report-views.ts`), nu inventate:
acolo stau motivele reale din darea de seamă a ANP. Codurile sunt stabile
(`termen_executat`), etichetele sunt cele din statistică.

**Condamnați** — termen executat; art. 91 (condiționat); grațiați (art. 108);
amnistiați (art. 107); boală (art. 95); art. 92 (pedeapsă mai blândă); achitați
(CSJ/CA); mecanism compensatoriu; alte motive.

**Preveniți** — încetarea procesului; înlocuire arest preventiv; revocare arest
preventiv; expirare termen legal; expirare termen instanță; achitare; pedeapsă
neprivativă; scoatere de sub urmărire; amnistiați; arest contravențional.

În listă apar grupate pe cele două categorii. Toate nouăsprezece, nu o selecție:
un temei lipsă împinge omul spre „alte motive", iar informația se pierde tăcut.

Codurile trăiesc într-un `Record<ReleaseGround, string>` din `src/lib/releases.ts`,
iar lista pentru meniu iese din el prin `optionsFrom()`. Aceeași apărare ca la
stările sarcinilor: o listă scrisă de mână pe lângă tip e o listă care rămâne în
urmă.

### 3. Responsabilul — comutator, nu nume în cod

Coloană nouă pe `profiles`, cu bifă pe `/admin`. Din ea ies două lucruri: cui
pleacă anunțul și eticheta „Responsabil: Ana Cojocari" de pe chenar.

Un id scris în cod ar merge azi și ar tăcea în ziua în care ea pleacă din
funcție — fără eroare, fără urmă. Bifa se mută în zece secunde.

Dacă nu e bifat nimeni, anunțul merge la administratori. O funcție care amuțește
dintr-o bifă uitată e mai rea decât una care anunță pe cine nu trebuie.

### 4. Anunțul — unul singur, în ziua eliberării

O funcție SQL rulată zilnic dimineața caută eliberările cu data de azi,
nebifate și fără `notified_at`, și scrie câte un rând în `notifications`. Apoi
pune `notified_at`, deci al doilea anunț nu mai pleacă niciodată.

**De ce în Supabase și nu pe Vercel.** Cele două sarcini programate ale planului
Hobby sunt deja ocupate de copia de siguranță (02:00 și 02:30). A treia n-ar
încăpea. `pg_cron` rezolvă mai curat oricum: scrie direct în tabel, fără HTTP,
fără secret de verificat, și merge chiar dacă nu deschide nimeni aplicația.
Cere activarea extensiei `pg_cron` din tabloul Supabase.

Ora: `0 4 * * *` UTC, adică 07:00 la Chișinău vara și 06:00 iarna. Ora exactă nu
contează — contează să fie înainte de programul de lucru.

Tipul notificării e nou (`eliberare`), deci constrângerea CHECK de pe
`notifications.type` se rescrie, iar uniunea `NotificationType` din TypeScript
capătă valoarea. Anunțul n-are `task_id` și nici `petition_id`, deci
`notificationHref` primește o ramură: tipul `eliberare` duce la `/eliberari`.

O eliberare introdusă chiar în ziua ei, după ce a rulat sarcina, nu produce
anunț. E în regulă: cine a introdus-o o știe, iar chenarul o arată oricum.

### 5. Chenarul de pe pagina de start

Sub banda obligațiilor, deasupra cardurilor — în primul ecran, fără derulare.

```
┌────────────────────────────────────────────────────────────┐
│ Eliberări · august 2026          Responsabil: Ana Cojocari │
│ 12 în total · 5 înregistrate · 7 rămase                    │
│                                                            │
│ ● AZI  14 aug  Popescu Ion       art. 91                   │
│   18 aug  Rusu Vasile      termen executat                 │
│   19 aug  Ciobanu Petru    mecanism compensatoriu          │
│                                          Toate eliberările │
└────────────────────────────────────────────────────────────┘
```

Se listează **doar cele rămase**, un rând de om, pe două-trei coloane după
lățimea ecranului. Cele bifate se numără sus, nu se listează.

Asta ține chenarul scurt fără să ascundă nimic. Într-o lună obișnuită sunt până
la zece eliberări, uneori cincisprezece; pe trei coloane, cincisprezece rânduri
înseamnă cinci rânduri înălțime la 1 august, iar lista se scurtează singură pe
parcursul lunii. Când s-a terminat, rămâne o linie liniștită: „Toate cele 12
eliberări din august sunt înregistrate."

Eliberările de azi ies în evidență. O dată trecută și nebifată se colorează ca
restanță — e singurul semn că ceva n-a fost dus până la capăt.

### 6. Pagina `/eliberari`

Fără tab în antet. Antetul are deja șase, iar al șaptelea ar da eliberările
drept al șaptelea registru zilnic, ceea ce nu sunt. Se ajunge din chenar
(„Toate eliberările") și dintr-un link de pe pagina de transferuri — cum se
ajunge la planificarea nominală.

Lista lunii, cu navigare între luni. Adăugare, editare, ștergere, bifa
„eliberat". Sub listă, o linie care pune numărul de nume alături de cifra din
registrul de cifre pentru aceeași lună: dacă sunt douăsprezece nume și cifra
spune unsprezece, se vede pe loc.

Comparația se arată, nu se impune. Cifra raportului rămâne introdusă de mână —
sunt două evidențe cu rosturi diferite, iar una derivată din cealaltă ar
ascunde exact nepotrivirea care merită văzută.

## Ce nu se face

Fără responsabil per rând, fără atașamente, fără export, fără completarea
automată a cifrei din raportul de marți, fără istoric al eliberărilor din anii
trecuți dincolo de navigarea între luni.

## Testare

Logica pură în `src/lib/releases.ts`, cu teste scrise înainte:

- ce intră în luna curentă, ce e „azi", ce e trecut și nebifat
- ordinea listei și împărțirea între „rămase" și „înregistrate"
- cine primește anunțul, inclusiv cazul „nimeni nu e bifat"

Plus testul care citește migrarea și cade dacă lista de temeiuri sau de tipuri
de notificare din TypeScript se desincronizează de constrângerile CHECK din baza
de date. Asta e apărarea împotriva bolii care ne-a dat bugul cu cinci tabele din
cincisprezece la copia de siguranță și starea lipsă din filtrul sarcinilor: o
sursă tipizată și o copie scrisă de mână care se depărtează de ea.

Ziua de referință vine peste tot din `todayInChisinau()`, ca valoare implicită
de parametru — nu `new Date()`, care pe Vercel e ceasul UTC și ar muta „azi" cu
o zi în fereastra dintre miezurile de noapte.
