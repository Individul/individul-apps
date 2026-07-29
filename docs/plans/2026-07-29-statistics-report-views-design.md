# Statistici — grafice pe raport (refacerea prezentării) — Design

**Data:** 2026-07-29
**Autor:** brainstorming cu Claude Code, pe baza feedbackului utilizatorului și a unui mockup aprobat

## De ce refacem

Prima versiune a paginii `/statistici` a fost respinsă de utilizator: *„nu îmi place cum arată,
procesul nu este pe înțeles, elegant"*.

Ce am construit era o **unealtă generică**: alegi tipul de raport, bifezi indicatori dintr-o
listă lungă, iese o linie. Corect tehnic, dar cere ca utilizatorul să știe dinainte ce caută și
să traducă singur nume de rânduri de Excel în întrebări. În plus, limbajul era de programator —
„indicatori", „serie: cumulat / perioada", „scor de potrivire 100%".

Ce vrea utilizatorul, în cuvintele lui: *„niște grafice în dependență de raport — la numărul
total o linie grafică, la eliberări un cerc împărțit sau niște dreptunghiuri"*.

Adică: **fiecare raport își primește graficele potrivite conținutului lui**, gata alese.

## Principiul: forma urmează întrebarea

| Raport | Întrebarea reală | Formă |
|---|---|---|
| Populație (`r_lunar`) | cum evoluează numărul de deținuți? | **linie** în timp + plafonul ca reper punctat |
| Liberări (`liberati`) | din ce se compune totalul? | **inel** împărțit pe motive |
| Comisia (`comisia`) | cum se compară art. 91 cu art. 92? | **bare grupate** |
| Grațiere (`gratiere`) | ce s-a întâmplat cu demersurile? | **bare** |
| Ședințe (`sedinte`) | teleconferință vs. instanță | **bare grupate** |
| Mecanism compensatoriu (`mc`) | cum evoluează reducerile? | **linie** în timp |
| Amnistii (`amnistia_2016`, `amnistia_2021`) | structura pe articole | **bare orizontale** |

Reguli derivate din ghidul de vizualizare, care nu se negociază:

- **Plafonul nu e o a doua serie**, ci o limită → linie punctată gri, nu culoare care concurează.
- **Inelul e admisibil doar sub ~7 felii.** Peste, trece automat pe **bare orizontale** —
  un cerc cu 12 felii nu se poate citi. Filtrul de zerouri (deja implementat) ține de obicei
  numărul mic: la liberări rămân 5 motive reale din ~15 rânduri.
- **O singură axă**, niciodată două scale.
- Culoarea urmează entitatea, în ordinea fixă a paletei; textul rămâne în cerneala de UI.

## Structura paginii

`/statistici` devine o pagină cu **o secțiune per raport**, în locul uneltei generice:

1. **Cifrele curente** (unde au sens) — 2-4 valori din ultima perioadă, ca numere mari.
   Ex. la populație: deținuți, plafon, locuri libere.
2. **Graficele raportului**, gata alese.
3. **Toate valorile** — un tabel pliabil, închis implicit, cu toți indicatorii perioadei.
   Esențial: prezentarea curatoriată nu are voie să ascundă date. Ce nu intră în grafice se
   găsește aici.

Secțiunile pentru care nu există încă niciun raport importat afișează o singură linie discretă
(„Niciun raport importat"), nu un bloc gol.

## Cum știe fiecare secțiune ce să deseneze

O **configurație declarativă per tip de raport** (`report-views.ts`): ce cifre mari, ce grafice,
ce serii, cu ce etichete scurte. Indicatorii se identifică după numele din fișier, dar
**comparat normalizat** (fără diacritice, spații colapsate, minuscule) și prin *potrivire de
început*, nu egalitate strictă — etichetele reale sunt lungi și pot varia la spații.

Dacă un indicator din configurație nu se găsește într-o perioadă, seria respectivă **lipsește**,
nu devine 0, iar graficul se desenează cu ce există. O configurație greșită nu trebuie să spargă
pagina.

## Import — limbaj și pași

Aceeași plângere („procesul nu e pe înțeles") vizează și fereastra de import. Schimbări minime,
fără să atingem logica:

- **Un singur ecran de confirmare, în limbaj normal:** „Am recunoscut: *Raport lunar*, perioada
  *30 iunie 2026*. E corect?" — cu tipul și data editabile dedesubt.
- Tabelul cu valorile extrase devine **pliabil, închis implicit** („Vezi cele 27 de valori
  extrase"), în loc să domine ecranul.
- Dispare jargonul: „indicatori" → „valori extrase"; „serie: cumulat / perioada" → „de la
  începutul anului" / „în perioadă"; scorul de potrivire dispare complet (rămâne doar
  „recunoscut automat" vs. „ales manual").

## Ce NU se schimbă

Importul propriu-zis, cititoarele, migrarea, drepturile, filtrul de zerouri. Este strict o
refacere a prezentării.

## Testare

- **Unit (Vitest):** potrivirea indicatorilor (normalizare, prefix, lipsă → serie absentă),
  alegerea automată inel vs. bare orizontale după numărul de categorii, extragerea valorilor
  pentru o configurație dată.
- **Build + lint** verzi. Verificarea vizuală o face utilizatorul după deploy (pagina e după login).

## Fișiere afectate (estimare)

- Nou: `src/lib/stats/report-views.ts` (+ test), `src/components/stats/report-section.tsx`,
  `src/components/stats/charts/` (linie, inel, bare).
- Modificate: `src/app/statistici/page.tsx`, `src/components/stats/import-dialog.tsx`.
- Înlocuit: `src/components/stats/series-chart.tsx` (unealta generică).
