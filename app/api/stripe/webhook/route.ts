import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'

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

    const { data: expert } = await supabaseAdmin
      .from('experts')
      .select('response_window_hours')
      .eq('id', session.metadata.expertId)
      .maybeSingle()

    const deadline = new Date()
    deadline.setHours(deadline.getHours() + (expert?.response_window_hours ?? 24))

    const { error } = await supabaseAdmin.from('questions').insert({
      expert_id: session.metadata.expertId,
      asker_email: session.metadata.email,
      question_text: session.metadata.question,
      stripe_payment_intent_id: session.payment_intent,
      price_cents: session.amount_total,
      deadline_at: deadline.toISOString(),
    })

    if (error) {
      await logError('stripe/webhook:checkout.session.completed', error, {
        sessionId: session.id,
        paymentIntentId: session.payment_intent,
        expertId: session.metadata?.expertId,
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