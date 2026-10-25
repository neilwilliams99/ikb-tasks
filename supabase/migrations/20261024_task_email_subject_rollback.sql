-- Undo 20261024_task_email_subject.sql.
--
-- Dropping the column throws away the original subject of every task raised
-- from an email, which cannot be rebuilt once a description has been edited.
-- The backfilled rows are not restored separately; they only ever held a copy
-- of their own description.

begin;

alter table public.tasks drop column if exists email_subject;

commit;
