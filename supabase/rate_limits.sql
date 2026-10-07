-- Rate limiting counters, used by lib/rate-limit.ts.
--
-- Run once in the Supabase SQL Editor of EACH project (dev and prod).
-- Safe to re-run. Until it has run, the app lets requests through unthrottled
-- (it fails open) rather than blocking real users.

create table if not exists public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (key, window_start)
);

-- Row Level Security on with no policies: only the service role (which
-- bypasses RLS) can read or write this table. Browsers never touch it.
alter table public.rate_limits enable row level security;

-- Atomically counts one hit in the current fixed window and reports whether
-- the caller is still within the limit.
create or replace function public.rate_limit_hit(
  p_key text,
  p_window_seconds integer,
  p_limit integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now          timestamptz := now();
  v_window_start timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count        integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;

  allowed := v_count <= p_limit;
  retry_after := greatest(
    1,
    ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer
  );
  return next;
end;
$$;

-- Supabase grants new functions to anon/authenticated by default; this one
-- must be callable by the server only.
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
