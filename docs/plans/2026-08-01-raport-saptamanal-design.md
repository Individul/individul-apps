# Raportul săptămânal pentru conducere — Design

**Data:** 2026-08-01

## Ce trebuie

În fiecare marți dimineața se informează conducerea despre săptămâna încheiată:
**plecați, sosiți, teleconferințe, eliberați**. Azi cifrele se adună de mână din
trei locuri, iar a patra nu există nicăieri în aplicație.

## Deciziile luate

### Săptămâna: marțea trecută → luni, inclusiv

Marțea în care se prezintă raportul intră în săptămâna **următoare**. Așa nicio zi
nu apare în două rapoarte consecutive, iar dimineața raportului nu depinde de date
care abia se întâmplă.

### Teleconferințe = petrecute + amânate

Cifra cerută e totalul. `hearings.tc_total` e deja **coloană generată** în Postgres
(`tc_petrecute + tc_amanate`), deci se citește direct — nicio socoteală nouă, și
nicio șansă ca cele două să nu corespundă.

Amânatele apar totuși separat, mic, dedesubt: totalul nu trebuie să ascundă din ce
se compune.

### Eliberați: registru nou, minuscul

Nu există nicio sursă în aplicație. Se adaugă un tabel cu **două câmpuri — ziua și
câți** — completat chiar pe pagina raportului, într-o zonă care nu se tipărește.

Alternativa — un câmp gol completat de mână pe raport în fiecare marți — a fost
respinsă: cifra n-ar rămâne nicăieri, nu s-ar putea verifica retroactiv, iar dacă
cine completează nu știe numărul exact marți dimineața, întârzie tot raportul.

Nu primește tab propriu: două câmpuri completate o dată pe săptămână nu justifică
un modul.

## Capcana care decide implementarea PDF-ului

**Fonturile standard din PDF nu conțin ș, ț și ă.** Codificarea lor (WinAnsi)
acoperă î și â, dar nu literele din Latin Extended. Nu e un risc, e o certitudine:
„Ședințe", „Plecați", „Sosiți", „Eliberați" — adică fiecare cuvânt din raport — ar
ieși cu semne greșite sau goluri.

Singura soluție e **includerea unui font propriu în proiect** (Noto Sans sau
DejaVu, ~400 KB, o singură dată). Costul e un fișier binar în repo; alternativa e
un document oficial scris greșit.

## Cum se generează

**O rută pe server care întoarce fișierul gata numit** (`raport-AAAA-LL-ZZ.pdf`),
cu **pdf-lib** plus fontkit pentru includerea fontului.

Trei motive pentru server, nu client:
- nicio bibliotecă grea nu ajunge în browser — pagina de start abia a fost curățată
  de balast;
- fișierul se descarcă direct, nu prin dialogul de tipărire;
- numele îl alegem noi, deci arhivarea e curată.

pdf-lib, nu ceva mai mare: documentul e o pagină cu antet, perioadă, patru cifre, un
tabel mic și subsol. Așezarea manuală pe coordonate e vreo optzeci de linii.

**Tipărirea din browser rămâne** — e tiparul casei, nu costă nimic. Două butoane:
„Descarcă PDF" și „Tipărește".

## Documentul

Antet: **„Date statistice"** plus perioada. Apoi cele patru cifre, amânatele mic
dedesubt, subsol cu numele celui care l-a întocmit și ora **Chișinăului** (nu a
serverului — vezi raportul de ședințe, unde asta a fost deja reparat).

## Plasa de siguranță

Dacă în intervalul raportat există zile lucrătoare fără date la ședințe, apare o
avertizare **înainte** de tipărire, cu link spre completare.

Fără ea, raportul ar arăta liniștit o cifră incompletă — exact felul de minciună
tăcută pe care aplicația asta o vânează peste tot. Funcția există deja
(`missingWorkdays` din `lib/hearings.ts`).

## Unde se intră

Buton discret pe pagina de start, sus: **„Raportul de marți"**. Un click, verifici
cifrele, completezi eliberările dacă lipsesc, descarci.

## Ce nu se face

- **Fără trimitere pe email.** Raportul se prezintă, nu se expediază.
- **Fără tab propriu** pentru eliberări.
- **Fără generare programată.** Se deschide când e nevoie; o rulare automată ar
  produce fișiere pe care nu le citește nimeni.

## Testare

Funcția săptămânii, cu teste pe **fiecare zi**: deschis marți arată săptămâna
tocmai încheiată; deschis luni arată săptămâna de dinainte, fiindcă cea curentă nu
e completă până la miezul nopții; navigarea înapoi/înainte nu sare și nu suprapune
intervale.

Agregarea celor patru cifre pe interval. Migrarea `0026` va fi prinsă automat de
testul de backup derivat din migrări — dacă tabelul nou nu intră în copie, testul
cade.

PDF-ul se verifică prin generare reală și **deschiderea fișierului**, nu prin teste
care i-ar imita conținutul: singura întrebare care contează e dacă diacriticele se
văd corect.

## Fișiere afectate (estimare)

- Nou: migrarea `0026_releases.sql`, `src/lib/weekly-report.ts` (+ test), pagina
  `/raport-saptamanal`, ruta de PDF, fontul în `public/`.
- Modificate: `src/app/page.tsx` (butonul), `src/lib/queries.ts`, README.
