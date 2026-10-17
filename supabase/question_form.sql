-- Question form: an expert can add a short note on what to include in a
-- question, and optional starter text that pre-fills the question box.
-- Both are plain text. The question itself is still one block of text.
--
-- Run once in the Supabase SQL Editor of EACH project (dev and prod), before
-- deploying the matching code. Safe to re-run.

alter table public.experts
  add column if not exists question_guidance text,
  add column if not exists question_template text;

alter table public.experts drop constraint if exists experts_question_guidance_len;
alter table public.experts
  add constraint experts_question_guidance_len
  check (question_guidance is null or char_length(question_guidance) <= 300);

alter table public.experts drop constraint if exists experts_question_template_len;
alter table public.experts
  add constraint experts_question_template_len
  check (question_template is null or char_length(question_template) <= 400);

-- An on/off switch, so an expert can keep their text but hide it from askers.
alter table public.experts
  add column if not exists question_form_enabled boolean not null default true;
