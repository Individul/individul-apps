# Backup automat — Design

**Data:** 2026-07-31
**Autor:** brainstorming cu Claude Code

## De ce

Utilizatorul a cerut „să avem un back-up mereu". Verificarea stării de fapt a scos
la iveală trei lucruri, în ordinea gravității.

### 1. Butonul existent salvează o șesime din date

`/admin/backup` a fost scris când aplicația avea doar modulul de sarcini și n-a mai
fost extins niciodată.

**Salvează:** `tasks`, `comments`, `tags`, `task_tags`, `profiles`.

**Nu salvează:** `petitions` (309 înregistrări), `petition_attachments`, `hearings`,
`transfers`, `transfer_plans`, `stat_reports`, `stat_values`, `subtasks`,
`audit_log`, `notifications`.

Cineva care apasă butonul crezând că are o copie de siguranță salvează 28 de sarcini
și pierde 309 petiții. Un backup incomplet e mai periculos decât lipsa lui, fiindcă
înlocuiește grija cu falsa liniște.

### 2. Supabase Pro nu salvează fișierele. Deloc.

Proiectul e pe planul Pro, care face backup zilnic al bazei de date, păstrat 7 zile.
Documentația spune însă limpede: *„Database backups do not include objects you store
via the Storage API, as the database only includes metadata about these objects."*

Adică: baza știe că există un fișier și cum îl cheamă; conținutul nu e salvat
nicăieri. Scanurile petițiilor și fișierele xlsx importate n-au nicio copie.

### 3. Fereastra de 7 zile

O ștergere observată după opt zile nu se mai poate repara: copia cu datele bune a
expirat. Recuperarea la un moment anume (PITR) e supliment separat, de la ~100 $/lună.

## Decizia care domină designul

Nu se poate „descarcă tot, în fiecare zi". O funcție Vercel are aproximativ un minut;
câteva sute de megabiți de scanuri nu se descarcă și nu se urcă în acel interval, zi
de zi, la nesfârșit.

Ieșirea vine dintr-o proprietate a datelor: **un scan de petiție se încarcă o dată și
nu se mai schimbă**. Fișierele sunt append-only. Deci se copiază **doar ce e nou**.

Într-o zi obișnuită asta înseamnă zero până la câteva fișiere. Prima rulare
backfill-ează tot ce există; următoarele sunt aproape instantanee.

Aceeași proprietate nu e valabilă pentru baza de date — rândurile se modifică — deci
acolo se salvează tot, în fiecare zi. E ieftin: câteva megabiți de text.

## Cum funcționează

**Vercel Cron**, zilnic, cheamă o rută protejată cu un secret. Ruta citește cu cheia
de serviciu, deci vede tot indiferent de RLS, și scrie într-un **repo privat pe
GitHub** prin API.

1. **Baza de date** — toate tabelele într-un fișier pe zi. Versionat de git, deci se
   poate reveni la starea de acum trei luni, nu doar la ultimele 7 zile.
2. **Fișierele** — se compară lista din buckete (`petitions`, `statistics`) cu un
   manifest al celor deja salvate; se urcă diferența; manifestul se actualizează.

### Ce nu se salvează, dinadins

Conturile de autentificare (email, parolă). Sunt în `auth.users`, la care aplicația
n-are acces prin cheia de serviciu în condiții obișnuite, iar parolele n-ar trebui
copiate nicăieri. La o restaurare, utilizatorii se creează din nou manual — sunt
patru-cinci.

## Partea care contează cel mai mult

**Cum afli că s-a stricat.**

Un backup care se oprește în tăcere e mai rău decât niciunul: te crezi acoperit
tocmai când nu ești. Tăcerea nu e dovadă că merge.

Fiecare rulare se înregistrează — reușită sau eșec, câte tabele, câte fișiere noi,
cât a durat. Dacă ultima **reușită** e mai veche de **3 zile**, apare o avertizare
vizibilă în aplicație.

Același principiu ca la zilele de transfer necompletate: golul e informația care nu
se vede altundeva.

## Restaurarea

**Nu se construiește buton de restaurare pentru toate tabelele.**

Ordinea inserării contează — petițiile înaintea atașamentelor, sarcinile înaintea
subsarcinilor, profilurile înaintea tuturor — iar un buton care rescrie baza peste
date bune e mai periculos decât lipsa lui. Restaurarea se face o dată la câțiva ani,
cu capul limpede, nu în panică.

În locul lui: **procedura scrisă pas cu pas în README**, cu ordinea tabelelor și
comenzile.

Ce contează la un backup e să existe, să fie complet și să fie citibil.

## Ce trebuie să configureze utilizatorul

- un **repo privat nou** pe GitHub, gol;
- un **token fine-grained** cu drept de scriere (Contents) **doar pe acel repo**;
- trei variabile în Vercel: repo-ul, tokenul, și secretul cronului.

Tokenul îl creează utilizatorul. Nu trece prin conversație și nu intră în repo.

## Riscuri asumate

**Numele de petiționari și de deținuți ajung la GitHub.** Utilizatorul a ales
varianta automată știind asta; alternativa propusă era descărcarea manuală pe un
calculator al instituției. Decizia îi aparține și e notată aici ca să rămână
explicită.

**Dimensiunea repo-ului.** GitHub recomandă sub 1 GB. Dacă scanurile depășesc pragul
în câțiva ani, destinația trebuie schimbată — se va vedea din evidența rulărilor,
care ține și volumul.

## Testare

Vitest, pe logica pură: ce fișiere lipsesc față de manifest, formatul numelui de
fișier zilnic, calculul „backupul e vechi de N zile". Ruta și apelurile către GitHub
se verifică la prima rulare reală, nu prin teste care ar imita API-ul.

## Fișiere afectate (estimare)

- Nou: rută de cron, client GitHub, helper-e de diff (+ teste), migrare pentru
  evidența rulărilor, componentă de avertizare.
- Modificate: `/admin/backup` (să acopere toate tabelele), `vercel.json` (cronul),
  README.
