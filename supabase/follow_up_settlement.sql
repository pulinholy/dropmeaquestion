-- Settlement bookkeeping for follow-up conversations: why a booking ended the
-- way it did, and the scheduled reminder emails to cancel if it's cancelled.
--
-- Run once in the Supabase SQL Editor of EACH project (dev and prod), after
-- follow_up_calls.sql. Safe to re-run.

alter table public.follow_up_calls
  add column if not exists settlement_reason text,
  -- Resend ids of reminder emails scheduled at confirmation time.
  add column if not exists reminder_email_ids jsonb;
