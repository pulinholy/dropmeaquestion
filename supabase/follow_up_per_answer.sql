-- Lets an expert switch the follow-up conversation offer off for a single
-- answer (the checkbox under the answer box). The answer email leaves out the
-- offer, and the booking page refuses that question.
--
-- Optional: without it, unchecking the box still leaves the offer out of the
-- email; it just isn't remembered for the booking page.

alter table questions
  add column if not exists follow_up_opted_out boolean not null default false;
