-- Follow-up conversations are on for everyone by default (no longer a private
-- beta). An admin can still switch an expert off (Admin > Experts), and each
-- expert still has to switch follow-ups on, set a price and connect Stripe
-- before anything is offered.
--
-- Run once in the Supabase SQL Editor of EACH project (dev and prod). Safe to
-- re-run.

alter table public.experts
  alter column follow_up_allowed set default true;

-- Everyone who exists today is allowed. (Run this only if no expert has been
-- deliberately switched off by an admin; otherwise leave the line out.)
update public.experts set follow_up_allowed = true where not follow_up_allowed;

-- New experts created from a browser session start allowed (before, they
-- started switched off). Browser sessions still can't change the column on an
-- existing row; the SQL Editor and our server can.
create or replace function public.protect_follow_up_allowed()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.follow_up_allowed := true;
    else
      new.follow_up_allowed := old.follow_up_allowed;
    end if;
  end if;
  return new;
end;
$$;
