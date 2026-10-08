import { stripe } from './stripe'
import { supabaseAdmin } from './supabase-admin'
import { logError } from './log-error'
import { confirmFollowUpPayment } from './confirm-follow-up-payment'
import { sendFollowUpReleasedEmail } from './send-follow-up-emails'
import { releaseFollowUpHold } from './follow-up-release'
import { captureFollowUpHold } from './follow-up-capture'
import { settleFollowUp } from './follow-up-settle'
import { logFollowUpEvent } from './follow-up-events'
import {
  FOLLOW_UP_AUTO_SETTLE_HOURS_AFTER_END,
  FOLLOW_UP_DURATION_MINUTES,
  autoSettlementFor,
} from './follow-up-rules'

// A Checkout page lives 30 minutes; this is how long we wait before treating
// an unpaid booking as abandoned.
const ABANDON_AFTER_HOURS = 2

// Runs from the daily reconcile cron. Two jobs, both safe to repeat:
//  1. Bookings stuck "awaiting_payment": if Stripe says the card hold
//     succeeded, finish it (the webhook never arrived); otherwise abandon.
//  2. Requests the expert never confirmed within 24 hours: release the hold
//     and tell the asker.
export async function maintainFollowUps() {
  const summary = {
    promoted: 0,
    abandoned: 0,
    expired: 0,
    released: 0,
    settled: 0,
    disputeReleased: 0,
    captured: 0,
    errors: 0,
  }

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
      await logFollowUpEvent(row.id, 'checkout_abandoned', 'system')
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

      await logFollowUpEvent(row.id, 'request_expired', 'system')
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

  // Confirmed calls whose time has passed and that nobody settled: decide from
  // who opened the join page (see autoSettlementFor for why).
  const settleCutoff = new Date(
    Date.now() - (FOLLOW_UP_DURATION_MINUTES * 60 * 1000 + FOLLOW_UP_AUTO_SETTLE_HOURS_AFTER_END * 3600 * 1000)
  ).toISOString()
  const { data: due, error: dueError } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, asker_joined_at, expert_joined_at, expert_marked')
    .eq('status', 'confirmed')
    .lt('confirmed_start', settleCutoff)

  if (dueError) {
    await logError('follow-up-maintenance:fetch-due', dueError)
    summary.errors++
  }

  for (const row of due ?? []) {
    try {
      // The asker has had a day since the call to confirm or report a problem.
      // The expert's own mark counts as their side being there even if they
      // opened their meeting link directly rather than through our button.
      const decision = autoSettlementFor({
        asker: Boolean(row.asker_joined_at),
        expert: Boolean(row.expert_joined_at) || Boolean(row.expert_marked),
      })
      const result = await settleFollowUp({
        id: row.id,
        from: ['confirmed'],
        outcome: decision === 'needs_review' ? 'disputed' : decision,
        reason: `auto_${decision}`,
        reportedBy: null,
      })
      if (result.ok) summary.settled++
    } catch (err) {
      await logError('follow-up-maintenance:settle', err, { followUpId: row.id })
      summary.errors++
    }
  }

  // Held for review but nobody decided: let the card go before the hold lapses.
  const holdDeadline = new Date(Date.now() + 12 * 3600 * 1000).toISOString()
  const { data: staleDisputes, error: staleError } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id')
    .eq('status', 'disputed')
    .is('captured_at', null)
    .is('released_at', null)
    .not('capture_before', 'is', null)
    .lt('capture_before', holdDeadline)

  if (staleError) {
    await logError('follow-up-maintenance:fetch-stale-disputes', staleError)
    summary.errors++
  }

  for (const row of staleDisputes ?? []) {
    const result = await settleFollowUp({
      id: row.id,
      from: ['disputed'],
      outcome: 'admin_release',
      reason: 'unresolved_before_hold_expiry',
    })
    if (result.ok) summary.disputeReleased++
  }

  // Conversations that ended with a charge owed but not yet confirmed
  // captured (the capture failed, or the process died): try again.
  const { data: uncaptured, error: uncapturedError } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, stripe_payment_intent_id')
    .in('status', ['completed', 'late_cancelled', 'asker_no_show'])
    .is('captured_at', null)
    .not('stripe_payment_intent_id', 'is', null)

  if (uncapturedError) {
    await logError('follow-up-maintenance:fetch-uncaptured', uncapturedError)
    summary.errors++
  }

  for (const row of uncaptured ?? []) {
    const ok = await captureFollowUpHold(row.id, row.stripe_payment_intent_id)
    if (ok) summary.captured++
    else summary.errors++
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
