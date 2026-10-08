-- Semnul „Atacat la CSJ" pe sarcină.
--
-- Un câmp al lui, nu o etichetă: etichetele spun ce fel de lucrare e sarcina
-- (cumulare, audiență) și se numără în raportul de activitate ca atare. Faptul
-- că sentința a fost atacată la Curtea Supremă de Justiție e o stare a
-- dosarului, nu un fel de lucrare — pus printre etichete, ar fi încurcat
-- tocmai socoteala pentru care au fost adăugate etichetele în raport.
--
-- Boolean, fără dată: s-a cerut sintagma lângă nume, nu o evidență a
-- recursurilor. Dacă va trebui și ziua atacării, se adaugă o coloană alături.

alter table tasks add column if not exists appealed_csj boolean not null default false;

-- Funcția de audit e una singură pentru toate tabelele, deci se rescrie
-- întreagă, ca la fiecare modul nou: e copia exactă din 0020, cu o singură
-- ramură în plus la sarcini.
create or replace function record_audit() returns trigger
  language plpgsql security definer
  set search_path = public
as $$
declare
  rec record;
  eid uuid := null;
  det jsonb := '{}'::jsonb;
  aname text := null;
  af text;
  atn text;
  pnum text;
begin
  if (TG_OP = 'DELETE') then rec := OLD; else rec := NEW; end if;

  if TG_TABLE_NAME = 'tasks' then
    eid := rec.id;
    if TG_OP = 'UPDATE' then
      det := jsonb_build_object('title', NEW.title);
      if NEW.status is distinct from OLD.status then
        det := det || jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status);
      end if;
      if NEW.priority is distinct from OLD.priority then
        det := det || jsonb_build_object('priority_from', OLD.priority, 'priority_to', NEW.priority);
      end if;
      if NEW.assignee_id is distinct from OLD.assignee_id then
        select full_name into af from profiles where id = OLD.assignee_id;
        select full_name into atn from profiles where id = NEW.assignee_id;
        det := det || jsonb_build_object('assignee_from', af, 'assignee_to', atn);
      end if;
      if NEW.title is distinct from OLD.title then
        det := det || jsonb_build_object('title_from', OLD.title, 'title_to', NEW.title);
      end if;
      if NEW.due_date is distinct from OLD.due_date then
        det := det || jsonb_build_object('due_from', OLD.due_date, 'due_to', NEW.due_date);
      end if;
      -- Semnul „Atacat la CSJ" schimbă felul în care se lucrează sarcina, deci
      -- punerea și scoaterea lui rămân în istoric, cu nume și oră.
      if NEW.appealed_csj is distinct from OLD.appealed_csj then
        det := det || jsonb_build_object('csj_to', NEW.appealed_csj);
      end if;
    else
      det := jsonb_build_object('title', rec.title, 'status', rec.status, 'priority', rec.priority);
    end if;
  elsif TG_TABLE_NAME = 'subtasks' then
    eid := rec.id;
    det := jsonb_build_object('task_id', rec.task_id, 'title', rec.title);
    if TG_OP = 'UPDATE' and (NEW.done is distinct from OLD.done) then
      det := det || jsonb_build_object('done_to', NEW.done);
    end if;
  elsif TG_TABLE_NAME = 'petitions' then
    eid := rec.id;
    det := jsonb_build_object('number', rec.number, 'petitioner', rec.petitioner);
    if TG_OP = 'UPDATE' then
      if NEW.status is distinct from OLD.status then
        det := det || jsonb_build_object('status_from', OLD.status, 'status_to', NEW.status);
      end if;
      if NEW.assignee_id is distinct from OLD.assignee_id then
        select full_name into af from profiles where id = OLD.assignee_id;
        select full_name into atn from profiles where id = NEW.assignee_id;
        det := det || jsonb_build_object('assignee_from', af, 'assignee_to', atn);
      end if;
      -- Data înregistrării mută termenul legal, deci orice schimbare a ei
      -- trebuie să rămână scrisă.
      if NEW.received_date is distinct from OLD.received_date then
        det := det || jsonb_build_object('received_from', OLD.received_date,
                                         'received_to', NEW.received_date);
      end if;
      if NEW.number is distinct from OLD.number then
        det := det || jsonb_build_object('number_from', OLD.number, 'number_to', NEW.number);
      end if;
    end if;
  elsif TG_TABLE_NAME = 'petition_attachments' then
    eid := rec.id;
    -- Numărul petiției se copiază aici: rândul de audit trebuie să se
    -- înțeleagă singur, chiar dacă petiția dispare ulterior.
    select number into pnum from petitions where id = rec.petition_id;
    det := jsonb_build_object('number', pnum, 'name', rec.name);
  elsif TG_TABLE_NAME = 'hearings' then
    eid := rec.id;
    det := jsonb_build_object('session_date', rec.session_date, 'total', rec.total_general);
    if TG_OP = 'UPDATE' and (NEW.total_general is distinct from OLD.total_general) then
      det := det || jsonb_build_object('total_from', OLD.total_general, 'total_to', NEW.total_general);
    end if;
  elsif TG_TABLE_NAME = 'transfers' then
    eid := rec.id;
    -- Ziua, instituția și cele două cifre: destul cât să se vadă în jurnal ce
    -- s-a schimbat fără deschiderea rândului.
    det := jsonb_build_object(
      'transfer_date', rec.transfer_date,
      'institution', rec.institution,
      'plecati', rec.plecati,
      'sositi', rec.sositi
    );
  elsif TG_TABLE_NAME = 'comments' then
    eid := rec.id;
    det := jsonb_build_object('task_id', rec.task_id);
  elsif TG_TABLE_NAME = 'tags' then
    eid := rec.id;
    det := jsonb_build_object('name', rec.name);
  elsif TG_TABLE_NAME = 'task_tags' then
    det := jsonb_build_object('task_id', rec.task_id, 'tag_id', rec.tag_id);
  elsif TG_TABLE_NAME = 'profiles' then
    eid := rec.id;
    det := jsonb_build_object('full_name', rec.full_name, 'role', rec.role);
  end if;

  select full_name into aname from profiles where id = auth.uid();

  insert into audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), aname, TG_OP, TG_TABLE_NAME, eid, det);

  return null;
end;
$$;
