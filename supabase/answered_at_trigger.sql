-- Stamps questions.answered_at on the server the moment a question becomes
-- answered, so it never depends on the expert's own device clock. The
-- follow-up offer window (14 days), the Payments page dates and the answer
-- email all read this column.
--
-- Safe to run more than once, and on a project that already has an
-- answered_at trigger (they'd both just set the same value).

alter table questions add column if not exists answered_at timestamptz;

create or replace function set_question_answered_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'answered'
     and new.answered_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'answered') then
    new.answered_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists set_question_answered_at on questions;
create trigger set_question_answered_at
  before insert or update on questions
  for each row execute function set_question_answered_at();

-- Questions answered before this existed have no date. The creation time is
-- the closest stand-in available; remove this line if you'd rather leave
-- them blank.
update questions
   set answered_at = created_at
 where status = 'answered' and answered_at is null;
