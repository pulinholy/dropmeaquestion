import { stripe } from './stripe'
import { supabaseAdmin } from './supabase-admin'
import { logError } from './log-error'

// Lets go of the asker's card hold and records when. released_at is only set
// once Stripe confirms the hold is gone, so a booking that ended without its
// hold being released can be found and retried by the daily job rather than
// leaving the asker's money tied up until the hold lapses.
export async function releaseFollowUpHold(
  followUpId: string,
  paymentIntentId: string | null | undefined
): Promise<boolean> {
  if (paymentIntentId) {
    try {
      await stripe.paymentIntents.cancel(paymentIntentId)
    } catch (err) {
      // Already cancelled counts as released.
      let alreadyGone = false
      try {
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
        alreadyGone = intent.status === 'canceled'
      } catch {
        // fall through to the failure path below
      }
      if (!alreadyGone) {
        await logError('follow-up-release', err, { followUpId, paymentIntentId })
        return false
      }
    }
  }

  const { error } = await supabaseAdmin
    .from('follow_up_calls')
    .update({ released_at: new Date().toISOString() })
    .eq('id', followUpId)
  if (error) {
    await logError('follow-up-release:record', error, { followUpId })
    return false
  }
  return true
}
