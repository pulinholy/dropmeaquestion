-- Follow-up conversations: one row per booking of a paid 15-minute call that
-- an asker can request AFTER an expert has answered their question.
--
-- Run once in the Supabase SQL Editor of EACH project (dev and prod), after
-- follow_up_settings.sql. Safe to re-run.
--
-- Server-only: row level security is on with no policies, and browser roles
-- have no grants, so only the service role (our API routes) can read or write
-- it. That matters because meeting_link must never reach a browser except
-- through our own access checks.
--
-- Lifecycle (see the follow-up call design notes):
--   awaiting_payment -> requested -> confirmed -> completed
--   and the endings: declined, expired, cancelled (cancelled_by says who),
--   late_cancelled, asker_no_show, expert_no_show, disputed.
-- Money: completed / late_cancelled / asker_no_show are captured in full;
-- declined / expired / cancelled / expert_no_show are released (no charge);
-- disputed stays held for manual review. All-or-nothing, never partial.

create table if not exists public.follow_up_calls (
  id                        uuid primary key default gen_random_uuid(),
  question_id               uuid not null references public.questions (id) on delete cascade,
  expert_id                 uuid not null references public.experts (id) on delete cascade,

  status                    text not null default 'awaiting_payment'
    check (status in (
      'awaiting_payment', 'requested', 'confirmed', 'completed',
      'declined', 'expired', 'cancelled', 'late_cancelled',
      'asker_no_show', 'expert_no_show', 'disputed'
    )),
  cancelled_by              text check (cancelled_by in ('asker', 'expert')),

  price_cents               integer not null check (price_cents between 1500 and 10000),
  platform_fee_cents        integer not null check (platform_fee_cents >= 0),

  asker_timezone            text,
  -- 1 to 3 proposed start times, as UTC ISO-8601 strings. Calls last 15 minutes.
  proposed_slots            jsonb not null
    check (jsonb_typeof(proposed_slots) = 'array' and jsonb_array_length(proposed_slots) between 1 and 3),
  confirmed_start           timestamptz,
  -- Added by the expert when they confirm; a fresh link per call. Server-only.
  meeting_link              text,

  -- Evidence for disputes: which policy text the asker agreed to, and when.
  policy_version            text not null,
  policy_accepted_at        timestamptz not null default now(),

  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text unique,
  -- Last moment the card hold can still be captured (from Stripe, per payment).
  capture_before            timestamptz,
  -- The expert must confirm by this time or the request expires and the hold is released.
  confirm_by                timestamptz,

  asker_joined_at           timestamptz,
  expert_joined_at          timestamptz,
  problem_reported_at       timestamptz,
  problem_reported_by       text check (problem_reported_by in ('asker', 'expert')),

  requested_at              timestamptz,
  confirmed_at              timestamptz,
  completed_at              timestamptz,
  cancelled_at              timestamptz,
  captured_at               timestamptz,
  released_at               timestamptz,
  created_at                timestamptz not null default now(),

  constraint follow_up_confirmed_has_time_and_link
    check (status <> 'confirmed' or (confirmed_start is not null and meeting_link is not null))
);

-- One booking in flight or already paid per question. A booking that was
-- declined, expired, cancelled early or released for an expert no-show does
-- not count, so the asker can try again.
create unique index if not exists follow_up_one_live_per_question
  on public.follow_up_calls (question_id)
  where status in (
    'awaiting_payment', 'requested', 'confirmed', 'completed',
    'late_cancelled', 'asker_no_show', 'disputed'
  );

create index if not exists follow_up_calls_expert_status_idx
  on public.follow_up_calls (expert_id, status);
create index if not exists follow_up_calls_status_confirm_by_idx
  on public.follow_up_calls (status, confirm_by);
create index if not exists follow_up_calls_status_start_idx
  on public.follow_up_calls (status, confirmed_start);

alter table public.follow_up_calls enable row level security;
revoke all on public.follow_up_calls from anon, authenticated;
