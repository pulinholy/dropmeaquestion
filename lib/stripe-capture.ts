import { stripe } from './stripe'
import { supabaseAdmin } from './supabase-admin'
import { logError } from './log-error'
import { parseUtcDate } from './question-deadline'

// How long a question's card hold is trusted to last. Stripe says holds on
// online card payments last about seven days, with some Visa cards shorter:
// four days and eighteen hours. We plan for the shorter one.
//
// The longest a hold has to survive for a question:
//   response window (at most 48 hours, counted from when the card was
//   authorized, not from when we noticed) + the nightly job that releases
//   unanswered questions running up to a day late = 72 hours.
// An answer is captured the moment it is saved, never later than the window.
// That leaves more than a day and a half of margin on the shortest hold.
export const QUESTION_HOLD_SAFE_HOURS = 4 * 24 + 18

export type CaptureResult =
  | { ok: true; alreadyCaptured: boolean }
  | { ok: false; reason: 'not_capturable' | 'stripe_error'; detail: string }

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Takes the money for an answered question, safely to repeat: a payment that
// was already taken counts as done, and a hold that no longer exists is
// reported instead of thrown. Brief trouble reaching Stripe is retried.
export async function captureQuestionPayment(paymentIntentId: string): Promise<CaptureResult> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (intent.status === 'succeeded') return { ok: true, alreadyCaptured: true }
      if (intent.status !== 'requires_capture') {
        return { ok: false, reason: 'not_capturable', detail: `payment is ${intent.status}` }
      }
      await stripe.paymentIntents.capture(paymentIntentId)
      return { ok: true, alreadyCaptured: false }
    } catch (err) {
      lastError = err
      const type = (err as { type?: string }).type
      // A refusal by Stripe won't change by asking again; only connection,
      // rate-limit and server-side trouble is worth another go.
      const retryable =
        type === 'StripeConnectionError' ||
        type === 'StripeAPIError' ||
        type === 'StripeRateLimitError'
      if (!retryable) break
      await wait(400 * 3 ** attempt)
    }
  }
  return { ok: false, reason: 'stripe_error', detail: (lastError as Error)?.message ?? 'unknown error' }
}

// A safety net for answers whose payment wasn't taken straight away (Stripe
// or the connection failed at that moment). Run by the nightly job: any
// question answered within the response time and still holding an
// uncaptured payment is captured now, while its hold is certainly valid.
export async function captureAnsweredQuestions(): Promise<{
  checked: number
  captured: number
  failed: number
}> {
  const since = new Date(Date.now() - (QUESTION_HOLD_SAFE_HOURS - 6) * 3600 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('questions')
    .select('id, stripe_payment_intent_id, answered_at, deadline_at')
    .eq('status', 'answered')
    .gte('answered_at', since)
    .not('stripe_payment_intent_id', 'is', null)
    .limit(200)
  if (error) {
    await logError('stripe-capture:fetch-answered', error)
    return { checked: 0, captured: 0, failed: 0 }
  }

  let captured = 0
  let failed = 0
  for (const q of data ?? []) {
    // Only answers given in time are ever charged.
    if (
      q.answered_at &&
      q.deadline_at &&
      parseUtcDate(q.answered_at).getTime() > parseUtcDate(q.deadline_at).getTime()
    ) {
      continue
    }
    const result = await captureQuestionPayment(q.stripe_payment_intent_id as string)
    if (result.ok && !result.alreadyCaptured) captured++
    if (!result.ok) {
      failed++
      await logError('stripe-capture:answered-uncaptured', new Error(result.detail), {
        questionId: q.id,
      })
    }
  }
  return { checked: data?.length ?? 0, captured, failed }
}
