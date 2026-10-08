import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'
import { releaseFollowUpHold } from '@/lib/follow-up-release'
import { logFollowUpEvent } from '@/lib/follow-up-events'
import { sendFollowUpReleasedEmail } from '@/lib/send-follow-up-emails'

// The expert can't make any of the proposed times. The asker's card hold is
// released (they're not charged) and they're invited to propose new times.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-expert-action', subject: user.id, limit: 60, windowSeconds: 3600 },
  ])
  if (limited) return limited

  let body: { id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // Claim it first, only if still waiting, so a request that just expired or
  // was confirmed can't be declined on top of that.
  const { data: claimed, error } = await supabaseAdmin
    .from('follow_up_calls')
    .update({ status: 'declined' })
    .eq('id', body.id)
    .eq('expert_id', user.id)
    .eq('status', 'requested')
    .select('id, question_id, stripe_payment_intent_id')

  if (error) {
    await logError('follow-up/decline', error, { followUpId: body.id })
    return NextResponse.json({ error: 'Could not decline. Please try again.' }, { status: 500 })
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json(
      { error: 'This request has already been handled or has expired.' },
      { status: 409 }
    )
  }
  const call = claimed[0]
  await logFollowUpEvent(call.id, 'declined', 'expert')

  // If letting go of the hold fails, the daily job retries it.
  await releaseFollowUpHold(call.id, call.stripe_payment_intent_id)

  try {
    const [{ data: question }, { data: profile }] = await Promise.all([
      supabaseAdmin.from('questions').select('asker_email').eq('id', call.question_id).maybeSingle(),
      supabaseAdmin.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    ])
    if (question?.asker_email) {
      await sendFollowUpReleasedEmail({
        askerEmail: question.asker_email,
        expertFirstName: profile?.full_name?.split(' ')[0] || 'The expert',
        questionId: call.question_id,
        reason: 'declined',
      })
    }
  } catch (notifyErr) {
    await logError('follow-up/decline:notification', notifyErr, { followUpId: call.id })
  }

  return NextResponse.json({ ok: true })
}
