# sarcini.dumitru.cloud — mutare completă pe Cloudflare

## Context

Aplicația de sarcini (`apps/task-manager` în `Individul/individul-apps`) rulează azi pe **Vercel** (Next 14.2.35, `fra1`) cu **Supabase** pentru tot ce ține de date: Postgres, logare, reguli de acces, triggere de audit, fișiere și notificări în timp real. Utilizatorul vrea s-o mute pe Cloudflare, unde stau deja celelalte aplicații ale lui (unelte, cloud-fisiere, statistici).

**Hotărâri luate cu utilizatorul:**
- se mută **totul**: găzduirea pe Workers, baza pe **D1**, fișierele pe **R2**, logarea într-un sistem propriu;
- planul **Workers Paid** e deja plătit pe cont;
- trecerea se face **întâi pe o adresă de probă**; Vercel și Supabase rămân pornite ca drum înapoi;
- **fără** Cloudflare Access: logarea rămâne nume de utilizator + parolă;
- **parolele se păstrează**: amprentele bcrypt se exportă din Supabase și se verifică la fel în aplicația nouă;
- lucrul se face **într-un chat separat**.

## Inventarul

**Date (măsurate pe 24.10.2026):**
- circa 4 000 de rânduri în 21 de tabele; cele mai mari sunt `audit_log` (1 496), `petitions` (425), `petition_attachments` (411) și `notifications` (393);
- **5 conturi**;
- bucketul `petitions` are **411 fișiere, 407 MB**;
- bucketul `statistics` are 19 fișiere, 0,3 MB.

**Ce face Supabase în locul codului:**
- **129 de interogări** `.from(...)` în ~20 de tabele, cu sintaxă PostgREST: îmbinări de forma `profiles!tasks_assignee_id_fkey(*)`, `tags(*)`, `petition_attachments(...)`, plus `count: exact`;
- **75 de reguli RLS**. Un singur loc le oglindește deja în cod: `src/lib/permissions.ts` (`canEditTask`, `canDeleteTask`, `canFinalizeTask`, `canReassignTask`, `canEditPetition`, `canDeletePetition`, `canReassignPetition`, `canEditComment`, `canDeleteComment`). Restul modulelor (inculpați, contravenienți, transferuri, ședințe, informări, eliberări, etichete, profiluri) au regula tipică „orice autentificat citește și scrie, doar adminul șterge" — scrisă doar în bază;
- **29 de triggere**:
  - 16 de audit: `record_audit` din 0033, plus funcțiile proprii pentru inculpați, contravenienți, transferuri planificate, informări și eliberări;
  - 9 `updated_at`;
  - `tasks_completed_at`, `tasks_reassign_guard`, `profiles_role_guard` și `on_auth_user_created`;
- **funcții apelate din aplicație**: `email_for_login`, `task_history`, `create_notifications`, plus `is_admin` și `can_modify_petition`, folosite în reguli;
- **logarea**:
  - `signInWithPassword`, cu numele de utilizator tradus în adresa `@intern.local`;
  - `auth.admin.createUser` / `deleteUser` din Administrare;
  - `updateUser` la schimbarea parolei;
  - `getUser` în 35 de locuri;
  - sesiunea reîmprospătată în middleware.

  Nu există trimitere de email. `auth/callback` (`exchangeCodeForSession`) e rămas nefolosit;
- **fișiere**: încărcare direct din browser (`petition-attachments.tsx`) și linkuri semnate valabile 60 de secunde (`attachment-actions.ts`);
- **timp real**: `notification-bell.tsx` ascultă `INSERT` pe `notifications` și arată și notificarea pe desktop;
- **legate de Vercel**:
  - `vercel.json` (regiunea și două cronuri pe `/api/backup`, la 02:00 și 02:30 UTC);
  - `@vercel/speed-insights`;
  - `outputFileTracingIncludes`;
  - `/raport-saptamanal/pdf`, care citește `src/fonts/*.ttf` cu `node:fs` (pe Workers nu există disc).

**Constrângere de versiune:** `@opennextjs/cloudflare` 1.20.13 cere `next >=15.5.28 <16` și `wrangler ^4.148`. Deci **Next 14 → 15.5.28 și React 18 → 19** vin înainte de orice. API-urile de cerere devin asincrone: `headers()` în `layout.tsx`, `cookies()` în `lib/supabase/server.ts` și `searchParams`/`params` în ~8 pagini și rute. `staleTimes` e deja fixat în `next.config.mjs`, deci implicitul de 0 din Next 15 nu încetinește navigarea.

## Arhitectura țintă

- **Next 15.5.28 + React 19** pe un Worker, prin `@opennextjs/cloudflare`.
  - Paginile sunt toate dinamice, deci fără cache incremental pe R2.
  - Legături: D1 `sarcini` (locație `eeur`), R2 `sarcini-fisiere`, cron.
- **Datele: Drizzle ORM peste D1.**
  - `src/lib/db/schema.ts` reproduce tabelele: `uuid` → `text`, `timestamptz` → text ISO, `jsonb` → text JSON, `boolean` → 0/1.
  - Interogările se rescriu modul cu modul, în spatele acelorași funcții din `src/lib/queries.ts` și din `actions.ts`, ca componentele să nu știe de schimbare.
- **Accesul: `src/lib/acl.ts`.**
  - Câte o funcție pentru fiecare dintre cele 75 de reguli.
  - Pentru sarcini, petiții și comentarii se refolosesc funcțiile din `permissions.ts`.
  - Fiecare acțiune de server verifică explicit înainte de scriere. Poarta din bază dispare, deci nicio scriere nu trece fără verificare.
- **Auditul: `src/lib/audit.ts`.**
  - Scrie rândul în `audit_log` **în același `batch` D1** cu schimbarea, cu actorul din sesiune.
  - Câmpurile `details` sunt **identice** cu cele scrise azi de triggere (`status_from`/`status_to`, `csj_to`, `days_from`/`days_to`…), ca `audit-table.tsx` și `task-history.tsx` să meargă neschimbate și istoricul vechi să se citească la fel.
  - În același strat se mută `updated_at`, `completed_at` și cele două gărzi: reatribuirea doar de admin, rolul doar de admin.
- **Logarea: tabela `users` și tabela `sessions` în D1.**
  - Parola se verifică cu `bcryptjs`, pe amprentele `$2a$` importate.
  - Cookie `httpOnly`, cu jetonul de sesiune păstrat în bază ca amprentă SHA-256.
  - Middleware-ul verifică sesiunea.
  - În Administrare: creare și ștergere de utilizatori și schimbarea parolei, cu aceeași interfață ca azi.
- **Fișierele: R2.**
  - Încărcarea trece prin server (sub 10 MB, cât acceptă și bucketul de azi).
  - Descărcarea trece printr-o rută care verifică sesiunea înainte să servească obiectul. Înlocuiește linkurile semnate de 60 de secunde.
- **Notificările.**
  - `create_notifications` devine o funcție din aplicație.
  - Clopoțelul verifică la 30 de secunde și la revenirea în fereastră, în loc de timp real. Notificarea pe desktop rămâne: apare pentru ce a sosit de la verificarea de dinainte.
- **Backup-ul.**
  - Scrie D1 și fișierele noi din R2 în același depozit GitHub privat (`task-manager-backup`), cu aceeași logică de porții și `backup_runs`.
  - Rulează la cronul Worker-ului: un handler `scheduled`, adăugat în intrarea OpenNext, cheamă **direct** funcția de backup — nu printr-o rută HTTP, deci fără secret de cron.
  - Butonul manual din Administrare cheamă aceeași funcție, pentru admin.
  - D1 Time Travel (30 de zile) vine pe deasupra.
- **PDF-ul.** Fonturile se împachetează în Worker ca date binare (regula `Data` din `wrangler.toml`), nu se mai citesc de pe disc.
- **Statisticile.** Tabelele `stat_*` și bucketul `statistics` **nu se mută**: modulul a plecat în aplicația lui. Rămân în Supabase și în ultima copie de backup.

## Unde se lucrează

Într-un **chat separat**, cerut de utilizator: o sesiune nouă, cu planul acesta copiat în depozit (`apps/task-manager/docs/cloudflare-plan.md`, necomis până la etapa 1). Chatul de acum rămâne pentru schimbările zilnice la aplicația de pe Vercel. Orice schimbare de acolo intră și în ramura `cloudflare`, prin `git merge main`, înainte de trecere.

## Etape

Fiecare etapă se încheie cu teste trecute și se poate verifica separat. Aplicația de pe Vercel rămâne neatinsă până la etapa 8.

0. **Next 15 + React 19, încă pe Vercel și Supabase.**
   - Codemod-ul `next-async-request-api`, `eslint-config-next` 15, verificarea compatibilității Radix, `react-hook-form` și `sonner`.
   - Se livrează în producție ca o schimbare obișnuită. Așa upgrade-ul nu se amestecă cu mutarea, iar o problemă de Next 15 se vede singură.
1. **Scheletul Cloudflare**, pe o ramură `cloudflare` a depozitului. Excepție de la „direct în main": mutarea ține săptămâni, iar `main` trebuie să rămână ce rulează pe Vercel.
   - `wrangler.toml`, OpenNext, D1 și R2 create cu `wrangler`;
   - Workers Builds legat de ramură, cu rădăcina `apps/task-manager`;
   - domeniul de probă **sarcini-cf.dumitru.cloud**;
   - fonturile PDF împachetate;
   - scoase `@vercel/speed-insights`, `vercel.json` și `outputFileTracingIncludes`.
   - **Se măsoară mărimea Worker-ului** (limita planului plătit e 10 MB).
2. **Schema D1 și importul de probă.**
   - `migrations/0001_init.sql` din schema Drizzle.
   - Script de import Supabase → D1 care refolosește `buildDump` din `src/lib/backup-dump.ts` (scoate deja toate tabelele ca JSON) și generează `INSERT`-uri pentru `wrangler d1 execute`.
   - Script pentru fișiere: Supabase Storage → R2.
3. **Logarea proprie**, cu importul amprentelor de parolă (pasul utilizatorului de mai jos).
4. **Stratul de date, modul cu modul**, în ordinea riscului: etichete și profiluri, sarcini (cu pași și comentarii), petiții (cu fișiere), ședințe, transferuri, inculpați, contravenienți, informări, eliberări, notificări, administrare. Pentru fiecare modul:
   - interogările Drizzle;
   - regulile din `acl.ts`;
   - auditul prin `audit.ts`.
5. **Fișierele pe R2**: încărcare, descărcare, ștergere.
6. **Notificările prin verificare periodică.**
7. **Backup și restaurare pe D1/R2, plus cronul**, cu o rulare manuală verificată în depozitul GitHub.
8. **Proba și trecerea.**
   - Câteva zile pe sarcini-cf.dumitru.cloud, cu o copie proaspătă a datelor. Utilizatorul lucrează pe ea; numărătorile pe tabele se compară cu Supabase.
   - În ziua trecerii:
     1. aplicația de pe Vercel trece în mod „doar citire", cu o bandă care anunță trecerea;
     2. reimport complet (4 000 de rânduri durează secunde) și sincronizarea fișierelor noi;
     3. `sarcini.dumitru.cloud` trece pe Worker;
     4. verificare;
     5. ramura `cloudflare` intră în `main`.
   - Vercel și Supabase rămân neatinse 30 de zile. Întoarcerea înseamnă domeniul înapoi pe Vercel și scoaterea modului „doar citire".

## Cine face ce

Utilizatorul e logat pe Cloudflare, Vercel și Supabase în Chrome și a cerut ca **totul să-l fac eu**. Panourile se folosesc prin Chrome-ul lui (`mcp__claude-in-chrome__*`), iar restul prin `wrangler`, `gh` și scripturi locale. Oprirea la utilizator rămâne doar unde regulile nu-mi lasă de ales:

- **Workers Paid**: deja plătit, spune utilizatorul. La etapa 1 doar verific, citind panoul (Workers & Pages → Plans), că abonamentul e activ pe contul `820175030a3273a778bdd45cf5a185a6`. Nu cumpăr și nu schimb nimic acolo.
- **Amprentele parolelor**: le mut eu, fără să treacă prin conversație.
  1. În SQL Editor (Chrome) creez temporar funcția `public.export_auth_hashes()`, `security definer`, executabilă **doar** de `service_role` (`revoke` de la `anon` și `authenticated`).
  2. Scriptul de import o cheamă cu cheia de serviciu din `.env.local` și scrie amprentele direct în D1, fără să le tipărească.
  3. Imediat după, funcția se șterge (`drop function`), iar ștergerea se verifică.
- **Secretele Worker-ului**: rămâne unul singur, jetonul GitHub pentru depozitul de backup. Nu am voie să introduc chei sau jetoane într-o aplicație de producție, deci utilizatorul rulează o singură comandă, `npx wrangler secret put BACKUP_GITHUB_TOKEN`, și lipește jetonul. Celelalte secrete le elimin din proiectare:
  - cronul cheamă backup-ul direct din `scheduled`, nu printr-o rută HTTP, deci nu-i mai trebuie `CRON_SECRET`;
  - sesiunile sunt jetoane aleatoare păstrate ca amprentă în D1, deci nu există cheie de semnare;
  - după trecere, aplicația nu mai are nevoie de cheile Supabase.
- **Confirmare explicită chiar în momentul faptei** pentru:
  - trecerea domeniului `sarcini.dumitru.cloud` pe Worker;
  - punerea aplicației de pe Vercel în modul „doar citire";
  - după cele 30 de zile, orice oprire sau ștergere în Vercel ori Supabase.

  Sunt fapte care ating toți utilizatorii sau nu se mai pot întoarce, deci se confirmă fiecare în parte, nu o dată pentru tot proiectul.

## Riscuri cunoscute

- **Mărimea Worker-ului**, cu Next 15 și toată aplicația. Se măsoară la etapa 1, înainte de restul muncii.
- **bcrypt pe Worker**: `bcryptjs` la cost 10 ia ~50–100 ms de procesor la logare. Încape în planul plătit.
- **Diferențe SQLite față de Postgres**: fără `ilike` și `jsonb`, alt fel de date calendaristice. Căutările se fac deja în memorie cu `fold`. Orice `order by` pe text sau pe dată se verifică prin teste pe date reale.
- **Pierderea porții din bază**: o acțiune uitată fără verificare ar scrie fără drept. De aceea fiecare acțiune primește teste pentru utilizatorul fără drept, nu doar pentru admin.

## Fișiere critice

- **De rescris:**
  - `src/lib/queries.ts`;
  - toate `src/app/**/actions.ts`, plus `src/app/login/actions.ts` și `src/app/admin/actions.ts`;
  - `src/lib/supabase/*`, care se înlocuiește cu `src/lib/db/*`, `src/lib/auth/*` și `src/lib/storage.ts`;
  - `src/middleware.ts`, `src/lib/notify*.ts`;
  - `src/components/notifications/notification-bell.tsx`, `src/components/petitions/petition-attachments.tsx`;
  - `src/app/api/backup/route.ts`, `src/app/raport-saptamanal/pdf/route.ts`.
- **Noi:** `src/lib/acl.ts`, `src/lib/audit.ts`, `src/lib/db/schema.ts`, `wrangler.toml`, `open-next.config.ts`, `migrations/0001_init.sql`, `scripts/import-*.mjs`.
- **De refolosit:** `src/lib/permissions.ts`, `src/lib/backup-dump.ts` (`buildDump`), `src/lib/backup.ts`, `src/lib/github.ts`, toate funcțiile pure din `src/lib/` cu testele lor.

## Verificare

- **După fiecare etapă:** `tsc`, `lint`, `vitest` și `build`, plus `opennextjs-cloudflare build` de la etapa 1. Cele aproximativ 500 de teste existente trebuie să treacă neschimbate.
- **Teste noi:**
  - `acl.ts`: fiecare regulă, cu un utilizator care are dreptul și cu unul care nu-l are;
  - `audit.ts`: `details` identic cu ce scria triggerul, pe aceleași schimbări;
  - logarea: amprentă bcrypt reală verificată, parolă greșită refuzată, sesiune expirată refuzată;
  - importul: numărătoare pe tabele egală în Supabase și D1, plus un eșantion de rânduri comparate câmp cu câmp.
- **Pe sarcini-cf.dumitru.cloud:**
  - logare cu parola veche;
  - fiecare modul deschis și o scriere în fiecare;
  - PDF-ul de marți descărcat;
  - un fișier de petiție urcat și descărcat;
  - notificare primită;
  - backup-ul manual ajuns în GitHub;
  - privire în panoul Browser și la 375px.
- **După trecere:**
  - `curl` pe `/login` (200) și pe paginile protejate (307);
  - `wrangler deployments list`;
  - cronul de noapte vizibil în `backup_runs` a doua zi.

## Starea lucrului

Ținută la zi la fiecare etapă: ce s-a făcut și ce s-a hotărât pe drum, față de planul de mai sus.

- **Etapa 0 — gata, în producție (24.10.2026).** Next 15.5.28 + React 19.3 pe Vercel (`a485771`). Verificarea a scos la iveală un defect mai vechi pe „Ședințe": intervalul se termina cu o zi mai târziu, din cauza fusului orar. Reparat în `899d67a`: perioada trece la browser ca AAAA-LL-ZZ, nu ca `Date`.
  - Din Next 15, buildId-ul nu mai apare în HTML ca `buildId`, ci sub cheia `"b"`:
    `curl -s https://sarcini.dumitru.cloud/login | grep -o '\\"b\\":\\"[A-Za-z0-9_-]*' | head -1 | sed 's/.*\\"//'`
- **Etapa 1 — gata (24.10.2026).**
  - D1 `sarcini` (`b585bf44-efcc-443e-a21b-95643163178e`, `eeur`), R2 `sarcini-fisiere` (`eeur`). Worker `sarcini` pe `sarcini-cf.dumitru.cloud`.
  - Workers Paid: activ, citit din panou.
  - **Mărimea Worker-ului: 2,83 MB comprimat** (11,3 MB necomprimat), din limita de 10 MB. Pornire: 13 ms.
  - **Fonturile PDF** intră în cod prin webpack (`asset` cu inline mereu), ca `data:` URL în base64, nu prin regula `Data` din `wrangler.toml`. Next împachetează serverul cu webpack înainte ca wrangler să vadă ceva, deci un import `.ttf` trebuie rezolvat de webpack. Așa merge la fel și sub `next dev`.
  - **Workers Builds se leagă abia după etapa 4.** Până atunci aplicația citește din Supabase și are nevoie la build de `NEXT_PUBLIC_SUPABASE_URL` și de cheia `anon`. Cheia nu se introduce în panou, deci până atunci publicarea se face local: `npx opennextjs-cloudflare build` cu variabilele din `.env.local`, apoi `npx opennextjs-cloudflare deploy`. După etapa 4 aplicația nu mai are nevoie de nicio cheie la build, iar Workers Builds se leagă de ramura `cloudflare`, cu rădăcina `apps/task-manager`.
  - `.open-next/`, `.wrangler/` și `.dev.vars*` sunt ignorate din `.gitignore`-ul de la rădăcină, ca `apps/task-manager/.gitignore` să rămână neatins.
