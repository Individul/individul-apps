-- Funcție ajutătoare: userul curent e admin?
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ===== tasks =====
drop policy if exists "tasks insert authenticated" on tasks;
create policy "tasks insert" on tasks
  for insert with check (
    is_admin()
    or (created_by = auth.uid() and (assignee_id = auth.uid() or assignee_id is null))
  );

drop policy if exists "tasks update authenticated" on tasks;
create policy "tasks update" on tasks
  for update using (
    is_admin() or created_by = auth.uid() or assignee_id = auth.uid()
  ) with check (
    is_admin() or assignee_id = auth.uid() or assignee_id is null
  );

drop policy if exists "tasks delete authenticated" on tasks;
create policy "tasks delete" on tasks
  for delete using (is_admin() or created_by = auth.uid());

-- ===== comments =====
drop policy if exists "comments delete own" on comments;
create policy "comments delete" on comments
  for delete using (is_admin() or auth.uid() = author_id);

-- ===== profiles =====
drop policy if exists "update own profile" on profiles;
create policy "profiles update" on profiles
  for update using (auth.uid() = id or is_admin());

create or replace function prevent_role_change_by_non_admin() returns trigger as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Doar adminul poate schimba rolul.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard before update on profiles
  for each row execute function prevent_role_change_by_non_admin();
