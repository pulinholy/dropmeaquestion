-- Asker review step for follow-up conversations.
--
-- The expert's "Mark completed" / "Asker didn't join" no longer charges the
-- asker on its own. It is recorded here as the expert's claim; the asker is
-- emailed shortly after the call ends and can confirm it (charged then) or
-- report a problem (held for review). If they do neither, the daily job
-- charges about a day after the call ends, using this claim plus who opened
-- the join page.
--
-- Run once in the Supabase SQL Editor of EACH project (dev and prod), after
-- follow_up_settlement.sql, and BEFORE deploying the matching code.
-- Safe to re-run.

alter table public.follow_up_calls
  add column if not exists expert_marked text
    check (expert_marked in ('completed', 'asker_no_show')),
  add column if not exists expert_marked_at timestamptz;
