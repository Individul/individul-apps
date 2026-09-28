-- Registrul contravenienților: cei aduși să execute arest contravențional.
--
-- Un registru al lui, nu o categorie în plus la „Preveniți și inculpați".
-- Acolo omul e în cercetare penală și are tip de penitenciar, instanță, dosar
-- și o trecere la condamnat; aici e o hotărâre contravențională cu un număr de
-- zile. Puse în aceeași tabelă, jumătate din coloane ar fi goale la jumătate
-- din rânduri, iar fiecare regulă de acolo ar trebui să știe să-i ocolească
-- pe ceilalți.

create table if not exists contraveners (
  id uuid primary key default gen_random_uuid(),

  last_name text not null check (length(trim(last_name)) > 0),
  first_name text not null check (length(trim(first_name)) > 0),
  -- Opțional dinadins: nu toți au patronimic (străinii, de pildă), iar un câmp
  -- obligatoriu i-ar lăsa pe aceia fără cale de a fi înscriși — sau cu o
  -- liniuță scrisă în loc, care ar arăta a nume.
  patronymic text,

  decision_date date not null,
  -- Poate lipsi la înscriere: hotărârea e știută înainte să fie definitivă.
  final_date date,

  -- Plafonul legal (60 de zile, la cumul) stă în aplicație, nu aici: o lege
  -- schimbată ar cere atunci o migrare ca să poți înscrie un om. Baza păzește
  -- doar ce nu poate fi niciodată adevărat.
  arrest_days integer not null check (arrest_days > 0),

  -- O hotărâre nu poate deveni definitivă înainte să fi fost dată. Scrisă
  -- invers, ar fi aproape sigur o dată inversată la tastare.
  constraint contraveners_final_after_decision check (
    final_date is null or final_date >= decision_date
  ),

  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contraveners_decision_idx on contraveners (decision_date desc);

drop trigger if exists contraveners_updated_at on contraveners;
create trigger contraveners_updated_at before update on contraveners
  for each row execute function set_updated_at();

alter table contraveners enable row level security;

-- Ca la celelalte registre ale secției: oricine autentificat citește și
-- completează; ștergerea e a adminului, iar cine a scris rămâne în audit.
drop policy if exists "contraveners select" on contraveners;
create policy "contraveners select" on contraveners
  for select using (auth.role() = 'authenticated');

drop policy if exists "contraveners insert" on contraveners;
create policy "contraveners insert" on contraveners
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "contraveners update" on contraveners;
create policy "contraveners update" on contraveners
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "contraveners delete" on contraveners;
create policy "contraveners delete" on contraveners
  for delete using (is_admin());

-- Date nominale: orice atingere lasă urmă.
create or replace function record_contravener_audit() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  rec record;
  det jsonb;
  aname text;
begin
  if (TG_OP = 'DELETE') then rec := OLD; else rec := NEW; end if;

  det := jsonb_build_object(
    'name', rec.last_name || ' ' || rec.first_name,
    'arrest_days', rec.arrest_days
  );
  if TG_OP = 'UPDATE' then
    -- Zilele sunt pedeapsa însăși: o schimbare a lor e fie corectarea unei
    -- greșeli, fie o greșeală nouă, și în ambele cazuri trebuie să se vadă cât
    -- a fost și cât s-a făcut.
    if NEW.arrest_days is distinct from OLD.arrest_days then
      det := det || jsonb_build_object('days_from', OLD.arrest_days, 'days_to', NEW.arrest_days);
    end if;
    if NEW.final_date is distinct from OLD.final_date then
      det := det || jsonb_build_object('final_from', OLD.final_date, 'final_to', NEW.final_date);
    end if;
  end if;

  select full_name into aname from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), aname, TG_OP, 'contraveners', rec.id, det);
  return null;
end;
$$;

drop trigger if exists audit_contraveners on contraveners;
create trigger audit_contraveners after insert or update or delete on contraveners
  for each row execute function record_contravener_audit();
