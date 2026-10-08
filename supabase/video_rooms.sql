-- DMQ-hosted audio conversations, slice 1 (see docs/video-production-plan.md).
--
--  * follow_up_calls.video_provider: how a booking is held. 'external' (the
--    expert pastes their own link, the existing behaviour) or 'dmq' (a private
--    room DMQ makes at first join). Existing bookings stay 'external'.
--  * video_room_*: the room's name, address and creation time, filled when the
--    first person joins.
--  * follow_up_video_sessions: one row per connection to a room, from the
--    video provider's signed join/leave events. This is what settlement and
--    the admin connection card read.
--
-- Nothing here changes behaviour by itself: the code that uses it ships
-- switched off (FOLLOW_UP_VIDEO). Run once in the Supabase SQL Editor of EACH
-- project (dev and prod), after follow_up_evidence.sql. Safe to re-run.

alter table public.follow_up_calls
  add column if not exists video_provider text not null default 'external'
    check (video_provider in ('external', 'dmq')),
  add column if not exists video_room_name text,
  add column if not exists video_room_url text,
  add column if not exists video_room_created_at timestamptz;

create unique index if not exists follow_up_calls_video_room_name_key
  on public.follow_up_calls (video_room_name)
  where video_room_name is not null;

create index if not exists follow_up_calls_video_room_created_idx
  on public.follow_up_calls (video_room_created_at)
  where video_room_created_at is not null;

-- A confirmed booking still needs a time; it needs a meeting link only when
-- the expert supplies one (external).
alter table public.follow_up_calls
  drop constraint if exists follow_up_confirmed_has_time_and_link;
alter table public.follow_up_calls
  add constraint follow_up_confirmed_has_time_and_link
  check (
    status <> 'confirmed'
    or (
      confirmed_start is not null
      and (video_provider = 'dmq' or meeting_link is not null)
    )
  );

create table if not exists public.follow_up_video_sessions (
  id            bigint generated always as identity primary key,
  follow_up_id  uuid not null references public.follow_up_calls (id) on delete cascade,
  role          text not null check (role in ('expert', 'asker')),
  -- The provider's id for one connection; a reconnect is a new session.
  session_id    text not null unique,
  joined_at     timestamptz not null,
  left_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists follow_up_video_sessions_follow_up_idx
  on public.follow_up_video_sessions (follow_up_id, joined_at);
create index if not exists follow_up_video_sessions_open_idx
  on public.follow_up_video_sessions (joined_at)
  where left_at is null;

alter table public.follow_up_video_sessions enable row level security;
revoke all on public.follow_up_video_sessions from anon, authenticated;
