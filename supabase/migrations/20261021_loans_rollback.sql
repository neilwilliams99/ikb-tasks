-- Rolls back 20261021_loans.sql. Deletes every saved loan.

begin;

drop table if exists public.loans;
drop table if exists public.loan_settings;

commit;
