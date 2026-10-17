// Quick checks for the question-form rules. Run: node scripts/question-form-test.mts
import assert from 'node:assert/strict'
import {
  GUIDANCE_MAX,
  STARTER_MAX,
  QUESTION_TEMPLATES,
  checkQuestionFormText,
  hasLinkOrContact,
  isUnchangedStarter,
// @ts-expect-error node needs the .ts extension here; the site's compiler does not
} from '../lib/question-form.ts'

// Every ready-made template passes its own rules.
for (const t of QUESTION_TEMPLATES) {
  assert.equal(checkQuestionFormText(t.guidance, GUIDANCE_MAX, 'g').ok, true, t.id + ' guidance')
  assert.equal(checkQuestionFormText(t.starter, STARTER_MAX, 's').ok, true, t.id + ' starter')
}

// Blocked content.
for (const bad of [
  'see https://example.com',
  'visit www.mysite.com',
  'my site is acme.io',
  'write to me@example.com',
  'call 415 555 0172',
  'call +1 (415) 555-0172',
]) {
  assert.equal(hasLinkOrContact(bad), true, bad)
}
// Ordinary text is fine.
for (const ok of ["What I've tried:", 'Budget: 2 to 3 weeks', 'Step 1. Then step 2.', 'I earn about 120k']) {
  assert.equal(hasLinkOrContact(ok), false, ok)
}

// Length limits.
assert.equal(checkQuestionFormText('x'.repeat(GUIDANCE_MAX + 1), GUIDANCE_MAX, 'g').ok, false)
assert.equal(checkQuestionFormText('x'.repeat(GUIDANCE_MAX), GUIDANCE_MAX, 'g').ok, true)

// Unchanged starter.
const s = QUESTION_TEMPLATES[0].starter
assert.equal(isUnchangedStarter(s, s), true)
assert.equal(isUnchangedStarter(s + '\r\n', s), true)
assert.equal(isUnchangedStarter(s.replace('My role:', 'My role: PM'), s), false)
assert.equal(isUnchangedStarter('anything', null), false)
assert.equal(isUnchangedStarter('', ''), false)

console.log('question-form: all checks passed')
