import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import {
  renderEmailLayout,
  renderEmailButton,
  renderEmailSecondaryButton,
  renderEmailQuote,
  EMAIL_BASE_URL,
} from '@/lib/email-layout'
import { logError } from '@/lib/log-error'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { escapeHtml, formatPrice, getFollowUpOffer } from '@/lib/follow-up'
import { videoMode } from '@/lib/video/config'

export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  // Per signed-in expert -- each call sends a real email from our domain.
  const limited = await enforceRateLimit(request, [
    { name: 'send-answer-email', subject: user.id, limit: 60, windowSeconds: 3600 },
  ])
  if (limited) return limited

  const { questionId, offerFollowUp } = await request.json()
  if (typeof questionId !== 'string') {
    return NextResponse.json({ error: 'Missing questionId' }, { status: 400 })
  }
  // The expert can switch the offer off for this one answer. Only an explicit
  // false opts out, so older pages that don't send it behave as before.
  const optedOut = offerFollowUp === false

  // Looked up server-side, never trusted from the client -- the expert's
  // browser must never hold the asker's email address at all, and the
  // content sent must be exactly what's stored, not whatever the request
  // body claims.
  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('expert_id, asker_email, question_text, answer_text')
    .eq('id', questionId)
    .maybeSingle()

  if (!question || question.expert_id !== user.id) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  const askerEmail = question.asker_email
  if (!askerEmail) {
    await logError('send-answer-email:lookup', new Error('Question missing asker_email'), { questionId })
    return NextResponse.json({ error: 'Could not find the question to notify' }, { status: 404 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const expertName = profile?.full_name || 'Your expert'
  const expertFirstName = expertName.split(' ')[0]
  const feedbackUrl = `${EMAIL_BASE_URL}/feedback/${questionId}`

  // An optional paid follow-up conversation, only when this expert offers
  // them and the offer is still open. Any trouble checking means no offer.
  if (optedOut) {
    // Remembered so the booking page refuses this question too. Ignored if
    // the column isn't there yet; the email still goes out without the offer.
    await supabaseAdmin
      .from('questions')
      .update({ follow_up_opted_out: true })
      .eq('id', questionId)
  }
  const offer = optedOut ? null : await getFollowUpOffer(questionId)
  const first = escapeHtml(expertFirstName)
  const onDmq = videoMode() === 'dmq'

  // The invitation is deliberately quieter than the answer: a light box with
  // an outlined button, after the answer and the request for feedback.
  const followUpBlock = offer?.ok
    ? `
    <div style="margin:28px 0 0; padding:16px 18px; background-color:#fbfaf7; border:1px solid #ddd6c8; border-radius:6px;">
      <p style="margin:0 0 4px; font-size:15px; font-weight:bold;">Want to talk it through with ${first}?</p>
      <p style="margin:0 0 10px; font-size:14px;">An optional, private 15-minute conversation &mdash; $${formatPrice(offer.priceCents)}.</p>
      <ul style="margin:0 0 12px; padding-left:18px; font-size:13px; color:#4a5568;">
        <li style="margin:0 0 4px;">${onDmq ? 'An audio call on Drop Me A Question. Your camera starts off.' : `A video meeting on ${first}&rsquo;s own meeting link.`}</li>
        <li style="margin:0 0 4px;">You propose up to three times; ${first} confirms one.</li>
        <li style="margin:0 0 4px;">${onDmq ? 'You appear as &ldquo;Guest&rdquo;, and your email address isn&rsquo;t shared.' : 'Your email address isn&rsquo;t shared. Your meeting profile&rsquo;s display name may be visible.'}</li>
        <li style="margin:0;">Your card is charged after the conversation, unless cancellation or no-show fees apply.</li>
      </ul>
      ${renderEmailSecondaryButton(`${EMAIL_BASE_URL}/follow-up/${questionId}`, `Book 15 minutes &mdash; $${formatPrice(offer.priceCents)} &rarr;`)}
    </div>
  `
    : ''

  // The written answer is the main content; everything else follows it.
  const body = `
    <p style="margin:0 0 18px;">${first} has answered your question.</p>
    <p style="margin:0 0 6px; font-family: Arial, Helvetica, sans-serif; font-size:11px; font-weight:bold; letter-spacing:0.06em; text-transform:uppercase; color:#4a5568;">Your question</p>
    ${renderEmailQuote(question.question_text)}
    <p style="margin:0 0 6px; font-family: Arial, Helvetica, sans-serif; font-size:11px; font-weight:bold; letter-spacing:0.06em; text-transform:uppercase; color:#4a5568;">${first}&rsquo;s answer</p>
    <div style="margin:0 0 24px; padding:16px 18px; background-color:#ffffff; border:1px solid #ddd6c8; border-radius:6px; font-size:16px; white-space:pre-wrap;">${escapeHtml(question.answer_text ?? '')}</div>
    <p style="margin:0 0 4px; font-weight:bold;">Was this helpful?</p>
    <p style="margin:0 0 10px; font-size:14px; color:#4a5568;">Your feedback helps ${first} and other askers.</p>
    ${renderEmailButton(feedbackUrl, 'Give feedback &rarr;')}
    ${followUpBlock}
  `

  try {
    const { data, error } = await resend.emails.send({
      from: 'Drop Me A Question <hello@dropmeaquestion.com>',
      to: askerEmail,
      subject: `${expertFirstName} answered your question`,
      html: renderEmailLayout(body),
    })

    if (error) {
      await logError('send-answer-email:resend', error, { askerEmail, questionId })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err) {
    await logError('send-answer-email', err, { askerEmail, questionId })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
