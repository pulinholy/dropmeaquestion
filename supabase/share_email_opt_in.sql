-- Askers can tick "share my email with the expert" at checkout.
-- Run this BEFORE deploying the code that sends the box (dev first, then prod).
-- Safe to run twice. Existing questions stay "not shared".

alter table public.questions
  add column if not exists share_email_with_expert boolean not null default false,
  add column if not exists share_email_consent_at timestamptz;
