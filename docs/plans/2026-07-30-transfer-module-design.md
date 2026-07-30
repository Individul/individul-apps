# Modulul Transfer — Design

**Data:** 2026-07-30
**Autor:** brainstorming cu Claude Code, pe baza cerințelor utilizatorului

## Ce construim

Evidența persoanelor transferate din și în Penitenciarul nr. 6. Modulul trebuie să
răspundă la întrebările: câți au plecat, câți au sosit, când, și cu ce instituție.

## Deciziile de bază și motivele lor

Trei alegeri au fost luate explicit de utilizator, după ce alternativele au fost puse
alături cu compromisurile lor. Le notez aici fiindcă schimbarea lor mai târziu costă
scump.

### Cifre, nu persoane

Se înregistrează **numere**, nu nume. Nu există rând per deținut.

Consecința de reținut: **din cifre nu se poate reveni la persoane.** Dacă vreodată va
fi nevoie de „unde a fost transferat X", datele istorice nu vor putea răspunde —
va trebui pornit un registru nominal de la zero, iar trecutul rămâne agregat.

Beneficiul real, în schimb: niciun nume de deținut nu ajunge în baza de date. Pentru
un sistem de penitenciar asta simplifică deopotrivă drepturile și expunerea la risc.

### Un singur număr, fără categorii

Nu se despart condamnații de preveniți. Utilizatorul a ales varianta cea mai simplă,
știind că despărțirea nu se poate face retroactiv peste totaluri deja introduse.

### Plecări și sosiri în același rând

Un rând acoperă relația cu o instituție într-o zi, în ambele sensuri. Alternativa —
un rând per direcție — dubla numărul de rânduri de completat și de citit.

## Schema

Un singur tabel, `transfers`. Un rând = **o zi + un penitenciar + planificat/urgent**.

```sql
transfer_date  date        -- ziua transferului
institution    smallint    -- 1..18, cu check: not in (6, 14)
kind           text        -- 'planificat' | 'urgent'
plecati        integer     -- din P-6 către instituția aceea
sositi         integer     -- de acolo către P-6
total          integer     generated always as (plecati + sositi) stored
note           text        -- „spitalizare", „la cererea instanței" etc.
unique (transfer_date, institution, kind)
```

**Instituția e un număr, nu text liber.** Eticheta („Penitenciarul nr. 3") se compune
în cod. Nimeni nu poate scrie „Penit. 3" într-o zi și „P-3" în alta, iar sortarea e
naturală.

**`check (institution between 1 and 18 and institution not in (6, 14))`** face două
lucruri deodată: nu se poate înregistra un transfer către propria instituție, iar
faptul că Penitenciarul nr. 14 nu există e scris în schemă, nu ascuns într-o listă
din cod. Confirmat de utilizator: nr. 14 nu există.

**`kind` intră în cheia unică**, nu doar data și instituția: într-o zi de transfer
programat poate apărea și o mișcare urgentă cu aceeași instituție, iar cele două
trebuie să rămână rânduri distincte, fiecare cu nota ei.

**Totalul e coloană generată**, ca la `hearings`: nu poate ajunge să nu corespundă cu
cele două numere din care iese, indiferent cine scrie în tabelă.

## Zilele programate

Transferurile sunt programate în prima și a treia zi de luni din fiecare lună.
Aplicația calculează asta singură, prin funcții pure, fără bază de date:

- care sunt zilele programate dintr-o lună;
- e data asta o zi programată?
- care e următoarea;
- ce zile programate din interval au rămas necompletate.

Din aceleași funcții ies toate cele trei comportamente vizibile: bifa „planificat"
preselectată când data introdusă e o luni programată, avertizarea pentru ziua
programată necompletată, și indicația „următorul transfer: 3 august".

Zilele viitoare nu pot lipsi, deci nu se semnalează — același principiu ca la
`missingWorkdays` din modulul de ședințe.

## Refactorizare pe drum

`lib/hearings.ts` conține deja utilitare care nu au nimic de-a face cu ședințele:
`Period`, `PERIODS`, `rangeForPeriod`, `toISODate`, `parseISODate`, `formatDateRo`,
`rangeLabelRo`. Se mută într-un modul comun, folosit de ambele module.

**Testele existente ale ședințelor trebuie să rămână verzi după mutare** — aceea e
dovada că refactorizarea n-a schimbat comportament.

## Interfața

Pagina `/transferuri`:

1. **Trei cifre** pentru perioada aleasă: plecați, sosiți, sold (sosiți − plecați).
2. **Avertizare** discretă dacă o zi programată a rămas necompletată, plus data
   următorului transfer.
3. **Registrul pe zile**, în ordine inversă: un antet per zi cu totalurile ei și
   eticheta planificat/urgent, sub el câte un rând per instituție.

Plecările și sosirile se disting prin **săgeți care diferă și ca direcție, nu doar ca
culoare** — ↑ roșu pentru plecați, ↓ verde pentru sosiți. Cine nu distinge roșu de
verde citește corect după formă. Unde nu e nimic într-un sens, se pune „—", nu 0:
lipsa mișcării și mișcarea de zero valori sunt lucruri diferite.

## Drepturi

Ca la ședințe, și din același motiv: oricine autentificat citește și completează —
altfel un coleg n-ar putea corecta ziua introdusă de altul. Ștergerea unui rând e doar
a adminului. Cine a scris rămâne în jurnalul de audit.

Auditul intră în **jurnalul existent** de la `/admin`, ca modul nou „Transferuri", nu
într-unul paralel.

## Hub

Card „Transferuri" cu plecați / sosiți / sold pe luna curentă. Modulul nu are noțiunea
de responsabil, deci cardul nu are defalcare pe persoane — spre deosebire de sarcini
și petiții.

## Testare

Vitest, pe tot ce e logică pură:

- zilele programate: prima și a treia luni, inclusiv lunile în care întâi e luni;
- `isScheduled`, `nextScheduled`, zilele programate necompletate;
- lista instituțiilor și etichetele lor (16 instituții: 1-18 fără 6 și 14);
- agregarea pe perioadă: plecați, sosiți, sold;
- testele existente ale ședințelor, verzi după mutarea utilitarelor.

Build și lint verzi. Verificarea vizuală o face utilizatorul după deploy — pagina e
după autentificare.

## Ce nu facem

- Nicio evidență nominală. Vezi motivul mai sus.
- Nicio notificare. Modulul e un registru, nu are destinatar.
- Nicio legătură automată cu modulul de statistici. Rapoartele lunare se importă din
  fișiere Excel; transferurile se introduc manual. Dacă se dovedește că cifrele
  trebuie confruntate, se adaugă ulterior, ca vedere separată.

## Fișiere afectate (estimare)

- Nou: migrarea `0020_transfers.sql`, `src/lib/transfers.ts` (+ test),
  `src/lib/periods.ts` (mutat din `hearings.ts`), `src/app/transferuri/`,
  `src/components/transfers/`.
- Modificate: `src/lib/hearings.ts` (rămâne doar ce ține de ședințe),
  `src/lib/audit-modules.ts`, `src/app/page.tsx` (cardul de hub),
  `src/components/layout/app-header.tsx` (tabul de modul), `README.md`.
