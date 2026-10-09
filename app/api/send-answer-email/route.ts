import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import { renderEmailLayout, renderEmailButton, renderEmailQuote, EMAIL_BASE_URL } from '@/lib/email-layout'
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
  const followUpBlock = offer?.ok
    ? `
    <hr style="border:0; border-top:1px solid #ddd6c8; margin:28px 0 20px;" />
    <p style="margin:0 0 8px; font-weight:bold;">Want to talk it through with ${escapeHtml(expertFirstName)}?</p>
    <p style="margin:0 0 16px;">Continue the conversation with a private 15-minute call &mdash; $${formatPrice(offer.priceCents)}.</p>
    ${renderEmailButton(`${EMAIL_BASE_URL}/follow-up/${questionId}`, `Book 15 minutes &mdash; $${formatPrice(offer.priceCents)} &rarr;`)}
    <p style="margin:16px 0 0; font-size:12px; color:#4a5568;">Your email address isn&rsquo;t shared by Drop Me A Question. ${videoMode() === 'dmq' ? 'The conversation takes place on Drop Me A Question as an audio call, with an optional camera, and you appear as &ldquo;Guest&rdquo;.' : `The conversation uses ${escapeHtml(expertFirstName)}&rsquo;s video meeting service, which may show your display name.`} You&rsquo;re charged only after the conversation takes place.</p>
  `
    : ''

  const body = `
    <p style="margin:0 0 16px;">${expertFirstName} answered the question you dropped:</p>
    ${renderEmailQuote(question.question_text)}
    <p style="margin:0 0 24px; white-space:pre-wrap;">${question.answer_text}</p>
    ${renderEmailButton(feedbackUrl, `Was this helpful? Let ${expertFirstName} know &rarr;`)}
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
