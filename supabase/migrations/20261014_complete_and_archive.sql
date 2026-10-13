-- IKB Tasks: complete / archive instead of hard delete.
--
-- Nothing is removed in normal use. A finished task or time entry gets a
-- completed_at stamp; a retired project gets archived_at. The pages hide those
-- rows by default. null = open/active, so every existing row stays as it was.
--
-- No grants are needed here, which is worth recording because it looks
-- otherwise at first glance. anon and authenticated already hold table-level
-- privileges on these tables (pg_class.relacl shows "arwdDxtm" for both), and
-- a table-level grant covers every column, including ones added later -- so
-- these columns are readable and writable the moment they exist. The reason it
-- looks like the tables were granted column by column is that
-- information_schema.column_privileges reports a table-level grant once per
-- column; none of these tables carry column-level ACLs of their own
-- (pg_attribute.attacl is null throughout).
--
-- Who can touch which rows is still decided by the ikb_tasks_users RLS policy
-- from 20261007_ikb_tasks_rls.sql, which is unchanged.
--
-- Roll back with 20261014_complete_and_archive_rollback.sql.

begin;

alter table public.tasks     add column if not exists completed_at timestamptz default null;
alter table public.timesheet add column if not exists completed_at timestamptz default null;
alter table public.projects  add column if not exists archived_at  timestamptz default null;

commit;
