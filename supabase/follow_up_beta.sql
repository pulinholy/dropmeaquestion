-- Private beta switch for follow-up conversations.
--
-- Only experts with follow_up_allowed = true see the "Follow-up conversations"
-- setting, get the per-answer option, or have the offer included in answer
-- emails. It is switched on per expert by an admin (Admin > Experts), or by
-- hand in SQL:
--
--   update public.experts set follow_up_allowed = true where id = '<expert id>';
--
-- Run once in the Supabase SQL Editor of EACH project (dev and prod), after
-- follow_up_settings.sql and BEFORE deploying the matching code. Safe to
-- re-run.

alter table public.experts
  add column if not exists follow_up_allowed boolean not null default false;

-- Experts who already switched follow-ups on before this existed keep them.
update public.experts set follow_up_allowed = true where follow_up_enabled;

-- Experts can update their own row from the browser, so without this they
-- could grant themselves access. Changes made by logged-in or anonymous
-- browser sessions are ignored for this column; the SQL Editor and our server
-- (service role) can still change it.
create or replace function public.protect_follow_up_allowed()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.follow_up_allowed := false;
    else
      new.follow_up_allowed := old.follow_up_allowed;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_follow_up_allowed on public.experts;
create trigger protect_follow_up_allowed
  before insert or update on public.experts
  for each row execute function public.protect_follow_up_allowed();
