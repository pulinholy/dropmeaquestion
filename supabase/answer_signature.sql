-- Answer signatures and the downloadable answer PDF.
--
-- experts.answer_signature: the sign-off an expert sets once in Page settings
--   (closing line, name, title, bold name, colour). Plain text fields only.
-- questions.answer_signature: a copy of that signature taken when the answer is
--   sent, so editing the signature later doesn't change answers people already
--   have. Only the server reads and writes it, so no browser grant is needed.
--
-- Safe to run more than once. The site keeps working before this runs: answers
-- are sent with the expert's name as a default signature, and the PDF uses the
-- same default.

alter table public.experts
  add column if not exists answer_signature jsonb;

alter table public.questions
  add column if not exists answer_signature jsonb;
