-- Rollback for 20261007_ikb_tasks_rls.sql: puts back the old "anyone can do
-- anything" policies. Only use this in an emergency; it re-opens all data.
begin;

do $$
declare
  t text;
begin
  foreach t in array array['projects', 'tasks', 'task_notes', 'timesheet', 'inspection_reports'] loop
    execute format('drop policy if exists ikb_tasks_users on public.%I', t);
    execute format('create policy %I on public.%I for all to public using (true)', 'public_' || t, t);
  end loop;
end $$;

drop function if exists public.ikb_tasks_allowed();

commit;
