import Stripe from 'stripe'
import { stripe } from './stripe'
import { supabaseAdmin } from './supabase-admin'
import { logError } from './log-error'
import {
  FOLLOW_UP_CONFIRM_HOURS,
  FOLLOW_UP_FALLBACK_HOLD_HOURS,
  usableSlotsForHold,
} from './follow-up'
import { releaseFollowUpHold } from './follow-up-release'
import {
  sendFollowUpReleasedEmail,
  sendFollowUpRequestedEmails,
} from './send-follow-up-emails'

// Runs when a follow-up conversation's card hold succeeds. Shared by the
// Stripe webhook (fast path) and the reconcile job (backstop), so a repeat
// call from either is always a harmless no-op.
export async function confirmFollowUpPayment({
  followUpId,
  paymentIntentId,
}: {
  followUpId: string
  paymentIntentId: string | null | undefined
}) {
  if (!paymentIntentId) {
    await logError('confirm-follow-up-payment', new Error('Missing payment intent'), {
      followUpId,
    })
    return
  }

  const { data: call } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, question_id, expert_id, status, price_cents, proposed_slots, asker_timezone')
    .eq('id', followUpId)
    .maybeSingle()

  if (!call) {
    await logError('confirm-follow-up-payment', new Error('Follow-up not found'), {
      followUpId,
    })
    return
  }
  if (call.status !== 'awaiting_payment') return

  // The real expiry of this card hold. Stripe says to rely on this field
  // because windows differ by card network and can change.
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  })
  if (intent.status !== 'requires_capture') {
    await logError('confirm-follow-up-payment', new Error('Payment is not on hold'), {
      followUpId,
      status: intent.status,
    })
    return
  }

  const charge = intent.latest_charge as Stripe.Charge | null
  const captureBeforeSeconds = charge?.payment_method_details?.card?.capture_before
  const captureBefore = captureBeforeSeconds
    ? new Date(captureBeforeSeconds * 1000)
    : new Date(Date.now() + FOLLOW_UP_FALLBACK_HOLD_HOURS * 3600 * 1000)

  const proposed = Array.isArray(call.proposed_slots) ? (call.proposed_slots as string[]) : []
  const usable = usableSlotsForHold(proposed, captureBefore)

  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('id, asker_email, reference_id')
    .eq('id', call.question_id)
    .maybeSingle()
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', call.expert_id)
    .maybeSingle()
  const expertFirstName = profile?.full_name?.split(' ')[0] || 'the expert'

  // None of the proposed times can be charged before this card's hold lapses
  // (a shorter-than-usual window): let the hold go and ask for earlier times.
  if (usable.length === 0) {
    const { data: released } = await supabaseAdmin
      .from('follow_up_calls')
      .update({
        status: 'expired',
        stripe_payment_intent_id: paymentIntentId,
        capture_before: captureBefore.toISOString(),
      })
      .eq('id', followUpId)
      .eq('status', 'awaiting_payment')
      .select('id')

    if (released && released.length > 0) {
      await releaseFollowUpHold(followUpId, paymentIntentId)
      if (question?.asker_email) {
        await sendFollowUpReleasedEmail({
          askerEmail: question.asker_email,
          expertFirstName,
          questionId: call.question_id,
          reason: 'times_unusable',
        })
      }
    }
    return
  }

  const now = new Date()
  const confirmBy = new Date(now.getTime() + FOLLOW_UP_CONFIRM_HOURS * 3600 * 1000)

  // The status guard makes this idempotent, like confirmQuestionPayment.
  const { data: updated, error } = await supabaseAdmin
    .from('follow_up_calls')
    .update({
      status: 'requested',
      stripe_payment_intent_id: paymentIntentId,
      capture_before: captureBefore.toISOString(),
      proposed_slots: usable,
      requested_at: now.toISOString(),
      confirm_by: confirmBy.toISOString(),
    })
    .eq('id', followUpId)
    .eq('status', 'awaiting_payment')
    .select('id')

  if (error) {
    await logError('confirm-follow-up-payment:update', error, { followUpId })
    return
  }
  if (!updated || updated.length === 0) return

  // Isolated so a failed email can never undo the booking.
  try {
    const { data: expertRow } = await supabaseAdmin
      .from('experts')
      .select('email_notifications')
      .eq('id', call.expert_id)
      .maybeSingle()
    let expertEmail: string | null = null
    if (expertRow?.email_notifications !== false) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(call.expert_id)
      expertEmail = authUser?.user?.email ?? null
    }

    if (question?.asker_email) {
      await sendFollowUpRequestedEmails({
        expertEmail,
        expertFirstName,
        askerEmail: question.asker_email,
        referenceId: question.reference_id,
        slots: usable,
        askerTimezone: call.asker_timezone,
        priceCents: call.price_cents,
      })
    }
  } catch (notifyErr) {
    await logError('confirm-follow-up-payment:notification', notifyErr, { followUpId })
  }
}
