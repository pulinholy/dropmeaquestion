import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'
import { confirmQuestionPayment } from '@/lib/confirm-question-payment'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    await logError('stripe/webhook:signature', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const questionId = session.metadata?.questionId

    if (!questionId) {
      await logError(
        'stripe/webhook:checkout.session.completed',
        new Error('Missing questionId in session metadata'),
        { sessionId: session.id }
      )
    } else {
      // The question already exists (created before checkout) -- this is a
      // small, idempotent status transition, not the only place the
      // question can come into existence.
      await confirmQuestionPayment({
        questionId,
        paymentIntentId: session.payment_intent,
      })
    }
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    const isOnboarded = Boolean(account.charges_enabled && account.payouts_enabled)

    const { error } = await supabaseAdmin
      .from('experts')
      .update({ stripe_onboarded: isOnboarded })
      .eq('stripe_account_id', account.id)

    if (error) {
      await logError('stripe/webhook:account.updated', error, {
        stripeAccountId: account.id,
      })
    }
  }

  return NextResponse.json({ received: true })
}
