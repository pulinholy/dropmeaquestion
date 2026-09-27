import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'
import { confirmQuestionPayment } from '@/lib/confirm-question-payment'

// This runs once/day (Vercel Hobby plan caps cron jobs at daily) -- it's a
// backstop for the rare webhook delivery that never fired, not a fast-follow
// path. MIN_AGE_MINUTES just guards against racing a webhook still in flight.
const MIN_AGE_MINUTES = 2
// Past this age with no confirmation, the asker almost certainly isn't
// coming back to finish checkout.
const ABANDON_AGE_HOURS = 2

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * 60 * 1000).toISOString()
  const abandonCutoff = new Date(
    Date.now() - ABANDON_AGE_HOURS * 60 * 60 * 1000
  ).toISOString()

  const { data: stuck, error: fetchError } = await supabaseAdmin
    .from('questions')
    .select('id, created_at, stripe_checkout_session_id')
    .eq('status', 'awaiting_payment')
    .lt('created_at', cutoff)

  if (fetchError) {
    await logError('cron/reconcile-payments:fetch', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const results = []

  for (const question of stuck ?? []) {
    try {
      // No Stripe Checkout Session was ever recorded -- create-checkout's own
      // cleanup should have caught this; this is the backstop for the rare
      // case that write was lost (e.g. the request died mid-flight).
      if (!question.stripe_checkout_session_id) {
        if (question.created_at < abandonCutoff) {
          await supabaseAdmin
            .from('questions')
            .update({ status: 'payment_abandoned' })
            .eq('id', question.id)
            .eq('status', 'awaiting_payment')
          results.push({ id: question.id, status: 'abandoned_no_session' })
        } else {
          results.push({ id: question.id, status: 'skipped_too_new' })
        }
        continue
      }

      const session = await stripe.checkout.sessions.retrieve(
        question.stripe_checkout_session_id
      )

      if (session.status === 'complete') {
        await confirmQuestionPayment({
          questionId: question.id,
          paymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id,
        })
        results.push({ id: question.id, status: 'promoted_to_pending' })
        continue
      }

      if (session.status === 'expired' || question.created_at < abandonCutoff) {
        await supabaseAdmin
          .from('questions')
          .update({ status: 'payment_abandoned' })
          .eq('id', question.id)
          .eq('status', 'awaiting_payment')
        results.push({ id: question.id, status: 'abandoned' })
        continue
      }

      results.push({ id: question.id, status: 'still_open' })
    } catch (err) {
      await logError('cron/reconcile-payments:process', err, {
        questionId: question.id,
      })
      results.push({ id: question.id, status: 'error', message: (err as Error).message })
    }
  }

  return NextResponse.json({ checked: stuck?.length ?? 0, results })
}
