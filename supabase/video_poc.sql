-- Proof of concept only: join/leave events received from the video provider's
-- webhook (see docs/video-provider-comparison.md). Safe to drop afterwards:
--   drop table public.video_poc_events;
--
-- Run once in the Supabase SQL Editor of the DEV project. Server-only: row
-- level security on, no policies, no browser grants.

create table if not exists public.video_poc_events (
  id           text primary key,            -- the provider's event id (dedupes retries)
  type         text not null,
  room         text,
  user_name    text,
  user_id      text,
  session_id   text,
  occurred_at  timestamptz,
  received_at  timestamptz not null default now(),
  raw          jsonb
);

alter table public.video_poc_events enable row level security;
revoke all on public.video_poc_events from anon, authenticated;
