-- IKB Tasks: keep the email's own subject, separately from the task text.
--
-- 20261024_task_email_link.sql stored the Exchange item id so a task could
-- link back to its email. Ids dragged from Outlook on the web turned out to
-- be rewritten whenever the message moves: four tasks raised from one email
-- held four different ids, none of which resolved afterwards. The subject
-- does not move, whoever sent it and wherever it is filed.
--
-- This has to be its own column: the dialog lets the subject be reworded into
-- a task before saving ("Reply to Dan about the gate screens"), and the
-- original is then the only record of which email the task came from.
--
-- It is not what the link uses. Linking to a subject search was tried and
-- does not work -- Outlook on the web ignores ?q= on a cold load -- so the
-- envelope opens the message by id and this column feeds its tooltip. Keeping
-- it is still worth the column: it survives the id going stale, and it is
-- what any later repair would match on.
--
-- The backfill fills in the two tasks that already carry an item id. Their
-- descriptions were checked against the mailbox and are still the untouched
-- subject, so copying them across is safe; the guard keeps it to rows that
-- came from an email and have no subject yet.
--
-- Roll back with 20261024_task_email_subject_rollback.sql.

begin;

alter table public.tasks add column if not exists email_subject text default null;

update public.tasks
   set email_subject = description
 where email_item_id is not null
   and email_subject is null;

commit;
