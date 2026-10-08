import { stripe } from './stripe'
import { supabaseAdmin } from './supabase-admin'
import { logError } from './log-error'
import { logFollowUpEvent } from './follow-up-events'

// Charges the asker's card hold in full (the platform fee and the transfer to
// the expert were fixed when the hold was placed). captured_at is only set
// once Stripe confirms, so a booking whose capture failed can be found and
// retried by the daily job instead of silently leaving the expert unpaid.
export async function captureFollowUpHold(
  followUpId: string,
  paymentIntentId: string | null | undefined
): Promise<boolean> {
  if (!paymentIntentId) {
    await logError('follow-up-capture', new Error('No payment on this booking'), { followUpId })
    return false
  }

  try {
    await stripe.paymentIntents.capture(paymentIntentId)
  } catch (err) {
    // Already captured counts as done; anything else (the hold expired, the
    // card was cancelled) needs a person, so it's logged loudly.
    let alreadyDone = false
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
      alreadyDone = intent.status === 'succeeded'
    } catch {
      // fall through
    }
    if (!alreadyDone) {
      await logError('follow-up-capture', err, { followUpId, paymentIntentId })
      return false
    }
  }

  const { error } = await supabaseAdmin
    .from('follow_up_calls')
    .update({ captured_at: new Date().toISOString() })
    .eq('id', followUpId)
  if (error) {
    await logError('follow-up-capture:record', error, { followUpId })
    return false
  }
  await logFollowUpEvent(followUpId, 'card_charged', 'system', { payment_intent: paymentIntentId })
  return true
}
