-- Prescripția executării: după un an de la data devenirii definitive,
-- hotărârea de arest contravențional nu mai poate fi pusă în executare, iar
-- secția trebuie să trimită o informare despre asta.
--
-- Două lucruri noi pe rând, amândouă necesare ca avertizarea să spună adevărul:
--
-- `executed_on` — fără el, după un an s-ar fi aprins avertizarea la toți, și
-- la cei care și-au ispășit demult zilele. Pentru un arest executat termenul
-- nu mai contează.
--
-- `informed_at` / `informed_by` — informarea trimisă, ca lista să arate cine
-- mai are nevoie de ea. Același tipar ca înștiințarea despre neexecutare de la
-- planificarea transferurilor (0029): momentul și omul, nu o simplă bifă.
--
-- Data expirării NU se scrie în bază. Se socotește din `final_date` la fiecare
-- citire: o coloană în plus ar fi trebuit ținută la zi la fiecare corectură a
-- datei definitive, iar prima uitare ar fi lăsat în registru un termen fals.

alter table contraveners
  add column if not exists executed_on date,
  add column if not exists informed_at timestamptz,
  add column if not exists informed_by uuid references profiles(id) on delete set null;

-- Un arest nu se execută înaintea hotărârii care l-a dat. Scrisă invers, data
-- ar fi aproape sigur o greșeală de tastare.
alter table contraveners drop constraint if exists contraveners_executed_after_decision;
alter table contraveners add constraint contraveners_executed_after_decision
  check (executed_on is null or executed_on >= decision_date);

-- Auditul, refăcut ca să vadă și cele două noutăți: executarea schimbă dacă
-- omul mai primește avertizare, iar informarea e un act trimis în afară —
-- amândouă trebuie să lase urmă cu nume și dată.
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
    if NEW.arrest_days is distinct from OLD.arrest_days then
      det := det || jsonb_build_object('days_from', OLD.arrest_days, 'days_to', NEW.arrest_days);
    end if;
    if NEW.final_date is distinct from OLD.final_date then
      det := det || jsonb_build_object('final_from', OLD.final_date, 'final_to', NEW.final_date);
    end if;
    if NEW.executed_on is distinct from OLD.executed_on then
      det := det || jsonb_build_object('executed_from', OLD.executed_on, 'executed_to', NEW.executed_on);
    end if;
    if (NEW.informed_at is null) is distinct from (OLD.informed_at is null) then
      det := det || jsonb_build_object('informed', NEW.informed_at is not null);
    end if;
  end if;

  select full_name into aname from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), aname, TG_OP, 'contraveners', rec.id, det);
  return null;
end;
$$;
