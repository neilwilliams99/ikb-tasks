-- IKB Tasks: only allowed, signed-in users can read or change the data.
--
-- Before this, every table had a "public_*" policy allowing anyone with the
-- (public) anon key to do anything. This Supabase project ("to_do") is shared
-- with Drawing Register, whose customers also have accounts here, so being
-- signed in is not enough: access is limited to the emails listed below.
--
-- To give someone else access, add their email to the list and re-run the
-- function definition. Roll back with 20261007_ikb_tasks_rls_rollback.sql.

begin;

create or replace function public.ikb_tasks_allowed()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'neil.williams@ikbeng.com'
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array['projects', 'tasks', 'task_notes', 'timesheet', 'inspection_reports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'public_' || t, t);
    execute format('drop policy if exists ikb_tasks_users on public.%I', t);
    execute format(
      'create policy ikb_tasks_users on public.%I for all to authenticated using (public.ikb_tasks_allowed()) with check (public.ikb_tasks_allowed())',
      t
    );
  end loop;
end $$;

commit;
