-- Evidența nominală a eliberărilor.
--
-- Separată de `releases`, care ține cifra lunară pentru raportul de marți: una
-- e numărul raportat conducerii, cealaltă e lista de lucru. Din cifră nu se
-- poate reveni la nume, iar din nume nu se completează automat cifra — vezi
-- designul pentru motiv.

create table if not exists release_plans (
  id uuid primary key default gen_random_uuid(),

  last_name text not null check (length(trim(last_name)) > 0),
  first_name text not null check (length(trim(first_name)) > 0),

  release_date date not null,

  -- Temeiurile reale din darea de seamă a ANP (`LIBERATI_MOTIVE` din
  -- src/lib/stats/report-views.ts). Toate nouăsprezece, nu o selecție: un temei
  -- lipsă împinge omul spre „alte motive" și informația se pierde tăcut.
  -- Lista e oglindită în `ReleaseGround` din src/lib/releases.ts, iar un test
  -- citește fișierul ăsta și cade dacă cele două se depărtează.
  ground text not null check (ground in (
    'termen_executat', 'art_91', 'art_108', 'art_107', 'art_95', 'art_92',
    'achitati_csj_ca', 'mecanism_compensatoriu', 'alte_motive',
    'incetarea_procesului', 'inlocuire_arest', 'revocare_arest',
    'expirare_termen_legal', 'expirare_termen_instanta', 'achitare',
    'pedeapsa_neprivativa', 'scoatere_urmarire', 'amnistiati_preveniti',
    'arest_contraventional'
  )),

  -- S-a eliberat efectiv. Fără bifă, o dată trecută nu spune dacă omul a ieșit
  -- sau dacă instanța a schimbat ceva în ultima zi.
  done boolean not null default false,

  -- Când a plecat anunțul. Nu un boolean: ora rămâne utilă când cineva întreabă
  -- de ce n-a văzut nimic dimineața.
  notified_at timestamptz,

  note text,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fără unicitate pe (nume, dată): omonimele există, iar doi oameni se pot
-- elibera în aceeași zi cu același temei.
create index if not exists release_plans_date_idx on release_plans (release_date);

drop trigger if exists release_plans_updated_at on release_plans;
create trigger release_plans_updated_at before update on release_plans
  for each row execute function set_updated_at();

alter table release_plans enable row level security;

-- Ca la celelalte registre ale secției: oricine autentificat citește și
-- completează, ștergerea e a adminului, cine a scris rămâne în audit.
drop policy if exists "release_plans select" on release_plans;
create policy "release_plans select" on release_plans
  for select using (auth.role() = 'authenticated');

drop policy if exists "release_plans insert" on release_plans;
create policy "release_plans insert" on release_plans
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "release_plans update" on release_plans;
create policy "release_plans update" on release_plans
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "release_plans delete" on release_plans;
create policy "release_plans delete" on release_plans
  for delete using (is_admin());

-- Funcție proprie, nu o ramură în `record_audit()`: vezi 0026:44.
-- Date nominale, deci orice atingere lasă urmă.
create or replace function record_release_plan_audit() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  rec record;
  det jsonb;
  aname text;
begin
  if (TG_OP = 'DELETE') then rec := OLD; else rec := NEW; end if;

  -- Ștampila anunțului nu e o atingere umană. `notify_todays_releases()` scrie
  -- `notified_at` în fiecare dimineață, iar fără ieșirea asta jurnalul ar primi
  -- zilnic un teanc de „a modificat eliberarea" fără autor și fără nicio
  -- schimbare de conținut — exact zgomotul care face ca urmele adevărate să nu
  -- mai fie citite. `updated_at` intră în aceeași scutire: îl mișcă trigger-ul,
  -- nu omul.
  if TG_OP = 'UPDATE'
     and (to_jsonb(NEW) - 'notified_at' - 'updated_at')
       = (to_jsonb(OLD) - 'notified_at' - 'updated_at') then
    return null;
  end if;

  det := jsonb_build_object(
    'name', rec.last_name || ' ' || rec.first_name,
    'release_date', rec.release_date,
    'ground', rec.ground
  );
  if TG_OP = 'UPDATE' then
    if NEW.release_date is distinct from OLD.release_date then
      det := det || jsonb_build_object('date_from', OLD.release_date,
                                       'date_to', NEW.release_date);
    end if;
    if NEW.done is distinct from OLD.done then
      det := det || jsonb_build_object('done_to', NEW.done);
    end if;
  end if;

  select full_name into aname from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), aname, TG_OP, 'release_plans', rec.id, det);
  return null;
end;
$$;

drop trigger if exists audit_release_plans on release_plans;
create trigger audit_release_plans
  after insert or update or delete on release_plans
  for each row execute function record_release_plan_audit();


-- ---------------------------------------------------------------------------
-- Responsabilul de eliberări
-- ---------------------------------------------------------------------------

-- Bifă pe profil, nu un id scris în cod. Un id ar merge azi și ar tăcea în ziua
-- în care omul pleacă din funcție — fără eroare, fără urmă. Din bifă ies două
-- lucruri: cui pleacă anunțul și eticheta „Responsabil: …" de pe chenar.
alter table profiles add column if not exists handles_releases boolean not null default false;

-- Bifa e a adminului, nu a fiecăruia pentru sine.
--
-- Politica „profiles update" (0002:63) lasă pe oricine să-și scrie propriul
-- rând — potrivit pentru nume și poză, nu și pentru asta: numele bifatului
-- ajunge pe pagina de start a întregii secții, ca „Responsabil: …". Fără gardă,
-- oricine s-ar putea trece acolo, iar ceilalți ar citi o informație falsă
-- despre cine răspunde de eliberări.
--
-- Trigger separat, nu o ramură în `prevent_role_change_by_non_admin` (0005):
-- garda rolului merge de patru ani și n-are de ce să fie rescrisă pentru o
-- coloană care n-are legătură cu ea.
--
-- Contextul de serviciu (auth.uid() null — SQL Editor, service role) e lăsat să
-- treacă, exact ca la garda rolului: e de încredere, iar prima bifare se poate
-- face din SQL.
create or replace function prevent_releases_flag_change_by_non_admin() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
begin
  if new.handles_releases is distinct from old.handles_releases
     and auth.uid() is not null and not is_admin() then
    raise exception 'Doar adminul poate schimba responsabilul de eliberări.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_releases_flag_guard on profiles;
create trigger profiles_releases_flag_guard before update on profiles
  for each row execute function prevent_releases_flag_change_by_non_admin();


-- ---------------------------------------------------------------------------
-- Anunțul din ziua eliberării
-- ---------------------------------------------------------------------------

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('assigned', 'comment', 'status', 'edited', 'deleted', 'created', 'eliberare'));

-- Anunțurile de azi. Rulată zilnic de pg_cron, întoarce câte a trimis.
--
-- `security definer` fiindcă scrie în `notifications` pentru alți utilizatori.
-- Tabelul acela n-are deloc politică de inserare (0008 definește doar
-- select/update/delete pe rândurile proprii), deci un apel obișnuit ar fi
-- respins din start.
--
-- Mesajul nu conține temeiul: eticheta lui trăiește în TypeScript, iar copiată
-- aici ar fi a doua listă de întreținut — exact tiparul pe care modulul îl
-- evită peste tot.
create or replace function notify_todays_releases() returns integer
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_recipients uuid[];
  v_count integer := 0;
  r record;
begin
  select coalesce(array_agg(id), '{}') into v_recipients
    from profiles where handles_releases;

  -- Nimeni bifat: merge la administratori. O funcție care amuțește dintr-o bifă
  -- uitată e mai rea decât una care anunță pe cine nu trebuie.
  if coalesce(array_length(v_recipients, 1), 0) = 0 then
    select coalesce(array_agg(id), '{}') into v_recipients
      from profiles where role = 'admin';
  end if;
  if coalesce(array_length(v_recipients, 1), 0) = 0 then return 0; end if;

  for r in
    select id, last_name, first_name from release_plans
    where release_date = (now() at time zone 'Europe/Chisinau')::date
      and not done
      and notified_at is null
  loop
    insert into notifications (user_id, type, message)
    select u, 'eliberare', 'Azi se eliberează ' || r.last_name || ' ' || r.first_name
    from unnest(v_recipients) as u;

    -- Ștampila cade în aceeași tranzacție cu inserarea, deci al doilea anunț nu
    -- mai pleacă niciodată — nici dacă sarcina programată rulează de două ori.
    update release_plans set notified_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Programarea, dacă extensia e activată. Blocul e păzit ca migrarea să treacă
-- și pe o bază fără pg_cron: funcția rămâne apelabilă manual, iar activarea se
-- poate face oricând după.
--
-- 04:00 UTC = 07:00 la Chișinău vara, 06:00 iarna. Ora exactă nu contează;
-- contează să fie înainte de programul de lucru.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('eliberari-azi', '0 4 * * *',
                          'select notify_todays_releases()');
  else
    raise notice 'pg_cron nu e activat: anunțul zilnic de eliberări nu e programat. Activează extensia și rulează cron.schedule manual (vezi supabase/README.md).';
  end if;
end $$;
