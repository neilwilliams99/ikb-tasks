-- Undo 20261024_task_email_link.sql.
--
-- Dropping the columns drops their grants with them. The tasks themselves are
-- untouched, but the link back to the originating email is lost and cannot be
-- rebuilt from the task description alone, so only run this if the feature is
-- being abandoned.

begin;

alter table public.tasks drop column if exists email_item_id;
alter table public.tasks drop column if exists email_mailbox;

commit;
