-- Lock down public.questions so the database itself keeps askers' emails
-- private, instead of relying on the app code to never ask for them.
-- Run on dev first, test the dashboard, then run on prod. Safe to run twice.
--
-- Before this: any signed-in expert could read asker_email on their own
-- questions straight from the API, anyone could insert question rows, and an
-- expert could rewrite any column of their own questions (including the new
-- share_email_with_expert flag).
--
-- After this, in the browser (anon / signed-in key):
--   * nobody can read asker_email
--   * experts can read every other column of their own questions (row policy)
--   * experts can change only a question's status (what Decline does)
--   * nobody can insert questions (checkout does it on the server)
-- The server (service role) is unaffected.
--
-- NOTE for later: a column added to questions after this is NOT readable from
-- the browser until you run: grant select (new_column) on public.questions to authenticated;

-- 0. Make sure the row policies are actually enforced (no change if already on)
alter table public.questions enable row level security;

-- 1. Reading
revoke select on public.questions from anon, authenticated;

do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'questions'
     and column_name not in ('asker_email');
  execute format('grant select (%s) on public.questions to authenticated', cols);
end $$;

-- 2. Writing
revoke update on public.questions from anon, authenticated;
grant update (status) on public.questions to authenticated;

-- 3. Inserting (the checkout route uses the service role, which bypasses this)
drop policy if exists "Anyone can insert a question" on public.questions;
revoke insert on public.questions from anon, authenticated;

-- Check: expect asker_email to be missing for anon and authenticated, and
-- update to be listed only for status.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'questions'
  and grantee in ('anon', 'authenticated')
  and (column_name = 'asker_email' or privilege_type in ('UPDATE', 'INSERT'))
order by privilege_type, grantee, column_name;
