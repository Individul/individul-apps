-- Data la care sarcina a fost îndeplinită.
--
-- Până acum se știa doar CĂ e „Gata", nu și DIN CE SĂPTĂMÂNĂ, deci la întrebarea
-- „cine ce a încheiat luna trecută" nu se putea răspunde deloc. La petiții
-- răspunsul era deja în date (`response_date`); la sarcini lipsea.
--
-- O pune baza, prin trigger, nu aplicația: starea unei sarcini se schimbă din
-- formular, din meniul listei și din tabloul cu coloane, iar peste un an vor fi
-- și alte locuri. Scrisă în fiecare dintre ele, data ar lipsi exact din cel
-- uitat — și ar lipsi tăcut, adică raportul ar arăta mai puțin lucru decât s-a
-- făcut. Aici nu se poate ocoli.

alter table tasks add column if not exists completed_at timestamptz;

-- Umplerea retroactivă, din jurnalul de audit, care ține din iulie 2026
-- trecerile de stare („status_to"). Acoperă 18 din cele 19 sarcini încheiate de
-- până acum; a nouăsprezecea e dinaintea jurnalului și rămâne fără dată — mai
-- bine nedatată și arătată ca atare decât pusă la nimereală într-o lună.
--
-- Trigger-ele se opresc pe durata umplerii, și nu de dragul vitezei: altfel
-- `tasks_updated_at` ar da tuturor celor 18 data de azi la „modificat", iar
-- `audit_tasks` ar scrie în jurnal 18 modificări pe care nu le-a făcut nimeni.
-- Umplerea reface trecutul, deci n-are voie să lase urme în prezent.
alter table tasks disable trigger user;

update tasks t
set completed_at = a.cand
from (
  select entity_id, max(created_at) as cand
  from audit_log
  where entity = 'tasks' and action = 'UPDATE' and details->>'status_to' = 'done'
  group by entity_id
) a
where a.entity_id = t.id and t.status = 'done' and t.completed_at is null;

-- Și cele scrise de la bun început „Gata", care n-au avut nicio trecere.
update tasks t
set completed_at = a.cand
from (
  select entity_id, min(created_at) as cand
  from audit_log
  where entity = 'tasks' and action = 'INSERT' and details->>'status' = 'done'
  group by entity_id
) a
where a.entity_id = t.id and t.status = 'done' and t.completed_at is null;

alter table tasks enable trigger user;

/*
 * De aici încolo o ține baza la zi.
 *
 * Data se pune la intrarea în „Gata" și se șterge la ieșirea din ea. Ștergerea
 * nu e simetrie de dragul simetriei: o sarcină redeschisă nu mai e îndeplinită,
 * iar dacă data ar rămâne, ea ar continua să se numere în raportul lunii în
 * care fusese închisă prima oară.
 *
 * Reintrarea în „Gata" o datează din nou, cu ziua de atunci. Deci o sarcină
 * închisă în iulie, redeschisă și închisă iar în septembrie se numără o singură
 * dată, la septembrie. Asta e și ce vede omul în listă — „Gata" de acum, nu de
 * atunci.
 *
 * `is distinct from` în loc de `<>` fiindcă `status` e text: la o valoare nulă
 * `<>` întoarce null, adică nici adevărat nici fals, iar ramura ar fi sărită.
 * Când starea rămâne „Gata" de la un capăt la altul al modificării, nicio
 * ramură nu se atinge de coloană — o corectură pusă de mână pe `completed_at`
 * rămâne acolo unde a pus-o omul.
 */
create or replace function set_task_completed_at() returns trigger
  language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.status = 'done' then
      NEW.completed_at := now();
    end if;
    return NEW;
  end if;

  if NEW.status = 'done' and OLD.status is distinct from 'done' then
    NEW.completed_at := now();
  elsif NEW.status is distinct from 'done' then
    NEW.completed_at := null;
  end if;
  return NEW;
end;
$$;

-- `before`, ca valoarea să intre în rândul care se scrie. Un `after` ar cere o
-- a doua scriere, care ar porni din nou trigger-ele — inclusiv auditul.
drop trigger if exists tasks_completed_at on tasks;
create trigger tasks_completed_at before insert or update on tasks
  for each row execute function set_task_completed_at();
