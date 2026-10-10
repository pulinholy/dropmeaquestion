import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import {
  renderEmailLayout,
  renderEmailQuote,
  renderEmailSecondaryButton,
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

  // The invitation comes after the answer and the request for feedback. The
  // three points beside it are plain images and text, because email programs
  // drop inline graphics and can't be relied on for columns.
  const icon = (name: string) => `${EMAIL_BASE_URL}/email/icon-${name}.png`
  const point = (img: string, alt: string, title: string, sub: string) => `
        <td width="33%" align="center" valign="top" style="padding:0 3px;">
          <img src="${icon(img)}" width="28" height="28" alt="${alt}" style="display:block; margin:0 auto 4px; border:0;" />
          <p style="margin:0 0 2px; font-family: Arial, Helvetica, sans-serif; font-size:12px; font-weight:bold; color:#17243a; line-height:1.3;">${title}</p>
          <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:11px; color:#4a5568; line-height:1.4;">${sub}</p>
        </td>`

  // After the answer, two quiet extras. Neither uses a filled button or a
  // tinted box, so the answer stays the main thing in the email.
  const followUpBlock = offer?.ok
    ? `
    <div style="margin:22px 0 0; padding:14px 16px; background-color:#faf8f4; border:1px solid #e6dfd0; border-radius:6px;">
      <p style="margin:0 0 3px; font-size:15px; font-weight:bold; line-height:1.3;">Want to talk it through with ${first}?</p>
      <p style="margin:0; font-size:13px; color:#4a5568;">An optional, private 15-minute call, only if you&rsquo;d like to discuss further.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 14px;">
        <tr>${
          onDmq
            ? point('video', 'Audio call', 'Audio or video call', 'Camera is off by default') +
              point('clock', '15 minutes', `15 minutes &middot; $${formatPrice(offer.priceCents)}`, 'You propose up to 3 times') +
              point('shield', 'Private', 'Join as Guest', 'Your email address isn&rsquo;t shared with the expert')
            : point('video', 'Video meeting', 'Video meeting', `On ${first}&rsquo;s own meeting link`) +
              point('clock', '15 minutes', `15 minutes &middot; $${formatPrice(offer.priceCents)}`, 'You propose up to 3 times') +
              point('shield', 'Private', 'Your email stays private', 'Your meeting profile&rsquo;s display name may be visible')
        }
        </tr>
      </table>
      ${renderEmailSecondaryButton(`${EMAIL_BASE_URL}/follow-up/${questionId}`, `Book 15 minutes &mdash; $${formatPrice(offer.priceCents)} &rarr;`)}
      <p style="margin:10px 0 0; font-family: Arial, Helvetica, sans-serif; font-size:11px; color:#4a5568;">Your card is charged after the conversation, unless cancellation or no-show fees apply. <a href="${EMAIL_BASE_URL}/conversation-policy" style="color:#4a5568; text-decoration:underline;">Conversation policy</a></p>
    </div>
  `
    : ''

  // The written answer is the main content; everything else follows it.
  const body = `
    <p style="margin:0 0 18px;">${first} has answered your question.</p>
    <p style="margin:0 0 6px; font-family: Arial, Helvetica, sans-serif; font-size:11px; font-weight:bold; letter-spacing:0.06em; text-transform:uppercase; color:#4a5568;">Your question</p>
    ${renderEmailQuote(question.question_text)}
    <div style="margin:0 0 20px; padding:20px 22px; background-color:#eaf2fb; border:1px solid #cddff2; border-radius:8px;">
      <p style="margin:0 0 10px; font-size:18px; font-weight:bold; line-height:1.3;">${first}&rsquo;s answer</p>
      <div style="font-size:16px; line-height:1.65; white-space:pre-wrap;">${escapeHtml(question.answer_text ?? '')}</div>
    </div>
    <p style="margin:0; font-size:13px; color:#4a5568;">Was this helpful? <a href="${feedbackUrl}" style="color:#17243a; font-weight:bold; text-decoration:underline;">Give feedback &rarr;</a></p>
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
