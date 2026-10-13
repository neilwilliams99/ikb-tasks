-- Undo 20261014_complete_and_archive.sql.
--
-- Dropping the columns drops their grants with them. This throws away which
-- rows were completed or archived, and the app goes back to hard-deleting, so
-- only run it if the feature is being abandoned.

begin;

alter table public.tasks     drop column if exists completed_at;
alter table public.timesheet drop column if exists completed_at;
alter table public.projects  drop column if exists archived_at;

commit;
