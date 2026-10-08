-- Problem reports and an evidence timeline for follow-up conversations.
--
--  * problem_reason / problem_note: why someone reported a problem (chosen
--    from a short list, plus an optional note), shown to whoever reviews it.
--  * follow_up_events: an append-only record of what happened to each
--    booking (policy accepted, card hold, confirmation, who opened the join
--    page and when, cancellations, reports, charge or release). It's the
--    evidence to pull together if a payment is disputed with the card network.
--
-- Run once in the Supabase SQL Editor of EACH project (dev and prod), after
-- follow_up_review.sql and BEFORE deploying the matching code. Safe to re-run.

alter table public.follow_up_calls
  add column if not exists problem_reason text
    check (problem_reason in ('no_show', 'link_failed', 'ended_early', 'other')),
  add column if not exists problem_note text
    check (problem_note is null or char_length(problem_note) <= 500);

create table if not exists public.follow_up_events (
  id            bigint generated always as identity primary key,
  follow_up_id  uuid not null references public.follow_up_calls (id) on delete cascade,
  event         text not null,
  actor         text not null check (actor in ('asker', 'expert', 'system', 'admin')),
  detail        jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists follow_up_events_follow_up_idx
  on public.follow_up_events (follow_up_id, created_at);

-- Server-only, like follow_up_calls: only our API routes (service role) can
-- read or write it.
alter table public.follow_up_events enable row level security;
revoke all on public.follow_up_events from anon, authenticated;
