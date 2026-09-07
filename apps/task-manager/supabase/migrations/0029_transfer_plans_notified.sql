-- Înștiințarea instanței despre imposibilitatea executării transferului.
--
-- Când nu mai există nicio zi de transfer înainte de ședință, omul nu poate fi
-- dus la timp, iar instanța trebuie înștiințată. Până acum registrul arăta cine
-- se află în situația asta, dar nu și pentru cine s-a trimis deja hârtia — se
-- ținea minte pe de rost sau pe o foaie alături.
--
-- NU e totuna cu `done`. „Încheiat" înseamnă că însemnarea s-a sfârșit; aici
-- omul rămâne mai departe în registru, fiindcă ședința se poate amâna, iar
-- atunci transferul redevine cu putință.
--
-- De aceea se ține minte și PENTRU CARE ședință s-a trimis. Ziua de transfer se
-- calculează din data ședinței, deci o amânare scoate omul singur din grupul
-- „de înștiințat"; dacă se amână iarăși într-o zi imposibilă, e altă situație
-- și cere altă hârtie. Fără `notified_hearing_date`, bifa veche ar rămâne
-- aprinsă peste noua imposibilitate — și ar spune, tăcut, că instanța a fost
-- înștiințată despre ceva ce nu s-a înștiințat.

alter table transfer_plans
  add column if not exists notified_at timestamptz,
  add column if not exists notified_by uuid references profiles(id) on delete set null,
  add column if not exists notified_hearing_date date;

-- Ori toate trei, ori niciuna: o dată de expediere fără ședința pentru care s-a
-- trimis n-ar putea fi verificată de nimeni, iar interfața ar trebui să
-- ghicească. Ce nu are înțeles nu trebuie să încapă în tabel.
alter table transfer_plans drop constraint if exists transfer_plans_instiintare;
alter table transfer_plans add constraint transfer_plans_instiintare check (
  (notified_at is null and notified_hearing_date is null)
  or (notified_at is not null and notified_hearing_date is not null)
);

-- Auditul: fiind vorba de o hârtie trimisă unei instanțe, expedierea și
-- retragerea ei lasă urmă, ca și celelalte atingeri ale registrului.
create or replace function record_transfer_plan_audit() returns trigger
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
    'court', rec.court,
    'hearing_date', rec.hearing_date
  );
  if TG_OP = 'UPDATE' then
    if NEW.hearing_date is distinct from OLD.hearing_date then
      det := det || jsonb_build_object('hearing_from', OLD.hearing_date,
                                       'hearing_to', NEW.hearing_date);
    end if;
    if NEW.done is distinct from OLD.done then
      det := det || jsonb_build_object('done_to', NEW.done);
    end if;
    if NEW.notified_at is distinct from OLD.notified_at then
      det := det || jsonb_build_object(
        'notified_to', NEW.notified_at is not null,
        'notified_for_hearing', NEW.notified_hearing_date
      );
    end if;
  end if;

  select full_name into aname from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), aname, TG_OP, 'transfer_plans', rec.id, det);
  return null;
end;
$$;
