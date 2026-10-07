import { stripe } from './stripe'
import { supabaseAdmin } from './supabase-admin'
import { logError } from './log-error'
import { confirmFollowUpPayment } from './confirm-follow-up-payment'
import { sendFollowUpReleasedEmail } from './send-follow-up-emails'
import { releaseFollowUpHold } from './follow-up-release'

// A Checkout page lives 30 minutes; this is how long we wait before treating
// an unpaid booking as abandoned.
const ABANDON_AFTER_HOURS = 2

// Runs from the daily reconcile cron. Two jobs, both safe to repeat:
//  1. Bookings stuck "awaiting_payment": if Stripe says the card hold
//     succeeded, finish it (the webhook never arrived); otherwise abandon.
//  2. Requests the expert never confirmed within 24 hours: release the hold
//     and tell the asker.
export async function maintainFollowUps() {
  const summary = { promoted: 0, abandoned: 0, expired: 0, released: 0, errors: 0 }

  const abandonCutoff = new Date(Date.now() - ABANDON_AFTER_HOURS * 3600 * 1000).toISOString()
  const { data: unpaid, error: unpaidError } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, stripe_checkout_session_id')
    .eq('status', 'awaiting_payment')
    .lt('created_at', abandonCutoff)

  if (unpaidError) {
    await logError('follow-up-maintenance:fetch-unpaid', unpaidError)
    summary.errors++
  }

  for (const row of unpaid ?? []) {
    try {
      let session = null
      if (row.stripe_checkout_session_id) {
        session = await stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id)
      }

      if (session?.status === 'complete') {
        await confirmFollowUpPayment({
          followUpId: row.id,
          paymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id,
        })
        summary.promoted++
        continue
      }

      if (session?.status === 'open') {
        await stripe.checkout.sessions.expire(row.stripe_checkout_session_id!)
      }
      await supabaseAdmin
        .from('follow_up_calls')
        .update({ status: 'expired', released_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'awaiting_payment')
      summary.abandoned++
    } catch (err) {
      await logError('follow-up-maintenance:unpaid', err, { followUpId: row.id })
      summary.errors++
    }
  }

  const { data: overdue, error: overdueError } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, question_id, expert_id, stripe_payment_intent_id')
    .eq('status', 'requested')
    .lt('confirm_by', new Date().toISOString())

  if (overdueError) {
    await logError('follow-up-maintenance:fetch-overdue', overdueError)
    summary.errors++
  }

  for (const row of overdue ?? []) {
    try {
      // Claim it first, only if still waiting, so an expert confirming at the
      // same moment can't be overridden.
      const { data: claimed } = await supabaseAdmin
        .from('follow_up_calls')
        .update({ status: 'expired' })
        .eq('id', row.id)
        .eq('status', 'requested')
        .select('id')
      if (!claimed || claimed.length === 0) continue

      await releaseFollowUpHold(row.id, row.stripe_payment_intent_id)

      const { data: question } = await supabaseAdmin
        .from('questions')
        .select('asker_email')
        .eq('id', row.question_id)
        .maybeSingle()
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', row.expert_id)
        .maybeSingle()

      if (question?.asker_email) {
        await sendFollowUpReleasedEmail({
          askerEmail: question.asker_email,
          expertFirstName: profile?.full_name?.split(' ')[0] || 'The expert',
          questionId: row.question_id,
          reason: 'expired',
        })
      }
      summary.expired++
    } catch (err) {
      await logError('follow-up-maintenance:overdue', err, { followUpId: row.id })
      summary.errors++
    }
  }

  // Bookings that ended without their card hold confirmed released (the
  // release failed earlier, or the process died): try again. Releasing an
  // already-released hold is a harmless no-op.
  const { data: unreleased, error: unreleasedError } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, stripe_payment_intent_id')
    .in('status', ['declined', 'expired', 'cancelled', 'expert_no_show'])
    .is('released_at', null)
    .not('stripe_payment_intent_id', 'is', null)

  if (unreleasedError) {
    await logError('follow-up-maintenance:fetch-unreleased', unreleasedError)
    summary.errors++
  }

  for (const row of unreleased ?? []) {
    const ok = await releaseFollowUpHold(row.id, row.stripe_payment_intent_id)
    if (ok) summary.released++
    else summary.errors++
  }

  return summary
}
