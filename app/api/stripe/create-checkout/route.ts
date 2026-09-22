import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'

const MAX_QUESTION_LENGTH = 500
const PLATFORM_FEE_RATE = 0.15

export async function POST(request: Request) {
  const { expertId, question, email, username } = await request.json()

  if (typeof question !== 'string' || question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Your question is too long (max ${MAX_QUESTION_LENGTH} characters).` },
      { status: 400 }
    )
  }

  try {
    const { data: expert } = await supabaseAdmin
      .from('experts')
      .select('price_cents, stripe_account_id, stripe_onboarded, is_active')
      .eq('id', expertId)
      .maybeSingle()

    if (!expert || !expert.is_active || !expert.stripe_onboarded || !expert.stripe_account_id) {
      return NextResponse.json(
        { error: 'This expert is not accepting questions right now.' },
        { status: 400 }
      )
    }

    const platformFee = Math.round(expert.price_cents * PLATFORM_FEE_RATE)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'One question, one real answer' },
            unit_amount: expert.price_cents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_intent_data: {
        capture_method: 'manual',
        application_fee_amount: platformFee,
        transfer_data: { destination: expert.stripe_account_id },
      },
      metadata: { expertId, question, email },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/${username}?paid=false`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    await logError('stripe/create-checkout', err, { expertId, username })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}