# Statistici — import din Excel + istoric — Design

**Data:** 2026-07-29
**Autor:** brainstorming cu Claude Code, pe fișiere reale din „Darea de seamă 30.06.2026"

## Scop

Rapoartele statistice se completează în continuare în Excel, ca acum. Aplicația le **importă**,
păstrează **istoricul** și arată **evoluția în timp** — fără să schimbe felul de lucru.

## Decizii (din brainstorming)

| Subiect | Decizie |
|---|---|
| Rol | Import fișiere Excel + istoric cu grafice (nu introducere manuală, nu generare) |
| Penitenciar | **Doar P-6** — restul coloanelor/rândurilor se ignoră |
| Acoperire | **Toate cele 8** tipuri de raport |
| Perioada | **Confirmată de utilizator** la încărcare (propusă din numele fișierului) |
| Indicatori | Se păstrează **toți**, filtrarea se face la afișare |
| `Forma_1.doc` | Exclus (Word binar vechi) |

## Cele 8 rapoarte și unde se află P-6

Fișierele au două aranjamente. „Cititorul" fiecărui tip localizează P-6 după **text**, nu după
coordonate fixe — ca o inserare de rând să nu strice importul.

### A. Indicatori pe rânduri × penitenciare pe coloane
Se caută în antet celula cu textul `P-6`; se ia acea coloană.

| Tip (slug) | Fișier-model | Antet | Observații |
|---|---|---|---|
| `r_lunar` | `01.06.2026_r_lunar.xlsx` | rând 3, `P-6` col 7 | Plafon, deținuți, suprapopulare, femei, minori, liberați… |
| `liberati` | `01.06.2026_liberați.xlsx` | rând 7, `P-6` col 7 | Liberări pe motive + decedați |
| `amnistia_2016` | `Amnistia_2016_…xlsx` | rând 5, `P-6` col 11 | Legea 210/2016 |
| `amnistia_2021` | `Amnistia_2021_…xlsx` | rând 1, `P-6` col 5 | Deja doar P-6 |

### B. Penitenciare pe rânduri × indicatori pe coloane
Se caută rândul al cărui prim text începe cu „Penitenciarul nr. 6" (sau „6 " — la `sedinte`,
unde scrie „6 Soroca"); indicatorii vin din antet.

| Tip (slug) | Fișier-model | Rând P-6 | Sub-rând |
|---|---|---|---|
| `gratiere` | `Gratierea  2026.xlsx` | „Penitenciarul nr. 6" | — |
| `comisia` | `Tabel_comisia_penitenciară_…xlsx` | „Penitenciarul nr. 6" | **da** |
| `mc` | `MC_2026.xlsx` | „Penitenciarul nr. 6" | **da** |
| `sedinte` | `Tabel sedinte judecată…xlsx` | „6 Soroca" | — |

**Sub-rândul** (la `comisia` și `MC`) e etichetat „Săptămînal" la celelalte penitenciare, dar
**„Lunar" la P-6** în fișierele curente. Deci nu ne legăm de text: luăm **rândul imediat
următor** după cel al penitenciarului și îl salvăm ca serie separată, cu indicatorii prefixați
(ex. `Perioadă / art. 91 CP`), lângă seria cumulată.

## Numele indicatorilor

Se compun din etichetele ierarhice ale rândului/coloanei, unite cu ` / `, exact cum se citesc în
Excel: `Materiale examinate la comisia penitenciarului / Total`, `Art. 12 / lit. a)`,
`Teleconferință / Amînate ședințe`. Valorile goale se ignoră; zerourile se păstrează (0 e informație).

## De ce perioada se confirmă manual

Datele din fișiere sunt contradictorii. În `Amnistia_2016`, titlul spune „la data de 30.06.2023",
celula alăturată conține 31.03.2024, iar fișierul face parte din darea de seamă la 30.06.2026.
Dacă am ghici, am construi un istoric fals fără ca nimeni să observe. Prin urmare: **propunem**
o dată (din numele fișierului, ex. `01.06.2026_…` sau `iunie 2026`), iar utilizatorul o
**confirmă sau o corectează** înainte de salvare, alegând și tipul perioadei (săptămânal / lunar).

## Model de date

Generic — o singură schemă pentru toate tipurile:

**`stat_reports`** — `id`, `kind` (slug), `period_date` (date), `period_type`
(`saptamanal`|`lunar`), `file_path` (bucket), `file_name`, `uploaded_by`, `created_at`.
Unic pe `(kind, period_date, period_type)` — reîncărcarea aceleiași perioade **înlocuiește**
(cu confirmare), ca să nu se dubleze istoricul.

**`stat_values`** — `id`, `report_id` (cascade), `indicator` (text), `series`
(`cumulat`|`perioada`), `value` (numeric), `position` (int, pentru ordinea din fișier).

Bucket privat **`statistics`** pentru fișierele originale (aceleași reguli ca la atașamentele de
petiții: acces prin linkuri semnate).

## Drepturi

Import și ștergere: **doar admin** (sunt date de raportare instituțională). Vizualizare: orice
utilizator autentificat. Impus prin RLS.

## Flux de import

1. Adminul alege fișierul (`.xlsx`).
2. Server-ul îl parsează și **detectează tipul** din titlu/structură (utilizatorul poate corecta).
3. **Previzualizare**: tipul detectat, perioada propusă, și lista completă a indicatorilor cu
   valorile extrase. Dacă perioada există deja, se anunță că va fi înlocuită.
4. La confirmare: fișierul urcă în bucket, se salvează raportul și valorile.

Fișierele sunt mici (11–18 KB), deci parsarea se poate face printr-o Server Action, fără
încărcare directă în storage.

**Bibliotecă:** `exceljs` pentru citire. (Nu `xlsx`/SheetJS: versiunea publicată pe npm e veche
și are o vulnerabilitate cunoscută nereparată acolo.)

## Pagina `/statistici`

- **Listă rapoarte**: tip, perioadă, cine a încărcat, link către fișierul original, ștergere (admin).
- **Evoluție**: alegi tipul de raport și unul sau mai mulți indicatori → **grafic în timp** +
  tabelul valorilor. Comparație între perioade.
- Intrare din antetul comun (tab nou „Statistici").

Pentru grafice se adaugă **Recharts** (aplicația nu are încă nicio bibliotecă de grafice).

## Testare

Fiecare „cititor" are teste pe **fișiere sintetice** care reproduc structura reală (aceleași
etichete și poziții relative), cu **cifre inventate**. Motiv: statisticile reale sunt date
instituționale interne și nu au ce căuta într-un repo a cărui vizibilitate nu e verificată.
Testele acoperă: localizarea P-6, compunerea etichetelor, sub-rândul de perioadă, valorile 0 vs.
goale, și comportamentul când formatul nu se potrivește (eroare clară, nu import tăcut greșit).

## Riscuri asumate

- **Formatul se poate schimba.** De aceea localizarea e după text, previzualizarea e obligatorie,
  iar un fișier nerecunoscut dă eroare explicită în loc să importe date greșite.
- **`Forma_1.doc`** rămâne în afara scopului.

## Migrare

`supabase/migrations/0016_statistics.sql` — tabelele, bucket-ul privat, RLS și politicile de storage.
