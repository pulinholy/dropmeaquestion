-- Expert settings for the optional paid follow-up conversation, used by
-- app/dashboard/pricing/page.tsx.
--
-- Run once in the Supabase SQL Editor of EACH project (dev and prod).
-- Safe to re-run. Until it has run, the Pricing page simply hides the new
-- "Follow-up conversations" section; nothing else changes.
--
-- A follow-up conversation is offered to an asker only after the expert has
-- answered their question (see the follow-up call design notes). Price is
-- limited to $15-$100 here as well as in the page, so it can't be bypassed.

alter table public.experts
  add column if not exists follow_up_enabled boolean not null default false,
  add column if not exists follow_up_price_cents integer;

alter table public.experts
  drop constraint if exists experts_follow_up_price_range;
alter table public.experts
  add constraint experts_follow_up_price_range
  check (follow_up_price_cents is null or follow_up_price_cents between 1500 and 10000);

alter table public.experts
  drop constraint if exists experts_follow_up_requires_price;
alter table public.experts
  add constraint experts_follow_up_requires_price
  check (not follow_up_enabled or follow_up_price_cents is not null);
