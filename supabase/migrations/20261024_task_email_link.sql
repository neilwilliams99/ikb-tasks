-- IKB Tasks: remember which email a task came from.
--
-- Dragging a message from Outlook onto the Task Board already fills the task
-- description from its subject. The same drag also carries the message's
-- Exchange item id and the mailbox it lives in, so storing those two lets a
-- task link straight back to the email it was raised from.
--
-- email_item_id is the id Outlook puts on the drag (latestItemIds). Tested
-- against Exchange Online: the link still resolves after the message has been
-- filed into another folder, so a task raised from the inbox keeps working
-- once the email is put away. Both columns stay null for tasks typed in by
-- hand, which is every task that exists today.
--
-- email_mailbox is the account the message was dragged from. The link the app
-- builds today does not use it -- it is stored because the item id alone does
-- not say which mailbox it belongs to, and that cannot be recovered later if
-- tasks ever start arriving from a shared mailbox.
--
-- No grants are needed; see the note in 20261014_complete_and_archive.sql for
-- why table-level privileges already cover columns added afterwards. Row
-- access is still decided by the ikb_tasks_users policy from
-- 20261007_ikb_tasks_rls.sql, which is unchanged.
--
-- Roll back with 20261024_task_email_link_rollback.sql.

begin;

alter table public.tasks add column if not exists email_item_id text default null;
alter table public.tasks add column if not exists email_mailbox text default null;

commit;
