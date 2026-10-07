-- Atomic expert registration, called by app/register/page.tsx.
--
-- Run once in the Supabase SQL Editor of EACH project (dev and prod), BEFORE
-- deploying the matching code. Safe to re-run.
--
-- Creates the caller's profile, expert record and topics in ONE transaction,
-- so a failure part-way can never leave a login with no page behind. It runs
-- as the signed-in user (auth.uid()) and re-checks the limits the form only
-- enforces in the browser. Errors are raised as short codes the page maps to
-- friendly messages: not_authenticated, already_registered, invalid_username,
-- invalid_name, invalid_price, invalid_response_window, bio_too_long,
-- invalid_topics, username_taken.

create or replace function public.create_expert_page(
  p_full_name              text,
  p_username               text,
  p_headline               text,
  p_bio                    text,
  p_price_cents            integer,
  p_response_window_hours  integer,
  p_topics                 jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid  := auth.uid();
  v_topics jsonb := coalesce(p_topics, '[]'::jsonb);
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.profiles where id = v_user) then
    raise exception 'already_registered';
  end if;

  if p_username is null or p_username !~ '^[a-z0-9-]{3,60}$' then
    raise exception 'invalid_username';
  end if;

  if p_full_name is null or length(trim(p_full_name)) = 0 or length(p_full_name) > 100 then
    raise exception 'invalid_name';
  end if;

  if p_price_cents is null or p_price_cents < 500 then
    raise exception 'invalid_price';
  end if;

  if p_response_window_hours is null
     or p_response_window_hours < 1
     or p_response_window_hours > 168 then
    raise exception 'invalid_response_window';
  end if;

  if p_bio is not null and length(p_bio) > 500 then
    raise exception 'bio_too_long';
  end if;

  if jsonb_typeof(v_topics) <> 'array' or jsonb_array_length(v_topics) > 5 then
    raise exception 'invalid_topics';
  end if;

  if exists (select 1 from public.profiles where username = p_username) then
    raise exception 'username_taken';
  end if;

  begin
    insert into public.profiles (id, full_name, username, is_expert)
    values (v_user, trim(p_full_name), p_username, true);

    insert into public.experts (id, headline, bio, price_cents, response_window_hours)
    values (v_user, p_headline, p_bio, p_price_cents, p_response_window_hours);

    -- Topics arrive as [{"name": "...", "slug": "..."}]. Blank entries and
    -- duplicate slugs are dropped; the original order is kept.
    with raw as (
      select left(trim(e.value ->> 'name'), 40) as name,
             e.value ->> 'slug'                 as slug,
             e.ord
      from jsonb_array_elements(v_topics) with ordinality as e(value, ord)
    ),
    dedup as (
      select distinct on (slug) name, slug, ord
      from raw
      where name <> '' and slug <> ''
      order by slug, ord
    )
    insert into public.expert_topics (expert_id, name, slug, sort_order)
    select v_user, name, slug, (row_number() over (order by ord) - 1)::integer
    from dedup;
  exception
    when unique_violation then
      -- Two people picking the same username at the same moment: the check
      -- above passed for both, the unique index stops one.
      if exists (select 1 from public.profiles where username = p_username) then
        raise exception 'username_taken';
      end if;
      raise;
  end;
end;
$$;

-- New functions are callable by anon by default; only signed-in users may call this.
revoke all on function public.create_expert_page(text, text, text, text, integer, integer, jsonb)
  from public, anon;
grant execute on function public.create_expert_page(text, text, text, text, integer, integer, jsonb)
  to authenticated;
