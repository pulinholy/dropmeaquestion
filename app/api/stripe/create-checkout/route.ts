import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'

const MAX_QUESTION_LENGTH = 1000
const PLATFORM_FEE_RATE = 0.15

export async function POST(request: Request) {
  const { expertId, question, email, username } = await request.json()

  if (typeof question !== 'string' || question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Your question is too long (max ${MAX_QUESTION_LENGTH} characters).` },
      { status: 400 }
    )
  }

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

  // Create the question first, in a not-yet-real state, so it exists in our
  // database independent of whether Stripe or its webhook ever come back.
  // Only its ID goes to Stripe -- the webhook's only job is to flip this
  // row to "pending" once payment is confirmed, not to create it.
  const { data: newQuestion, error: insertError } = await supabaseAdmin
    .from('questions')
    .insert({
      expert_id: expertId,
      asker_email: email,
      question_text: question,
      status: 'awaiting_payment',
      price_cents: expert.price_cents,
    })
    .select('id')
    .single()

  if (insertError || !newQuestion) {
    await logError('stripe/create-checkout:insert', insertError, { expertId })
    return NextResponse.json(
      { error: 'Could not start your question. Please try again.' },
      { status: 500 }
    )
  }

  const platformFee = Math.round(expert.price_cents * PLATFORM_FEE_RATE)

  try {
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
      metadata: { questionId: newQuestion.id },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/${username}?paid=false`,
    })

    const { error: updateError } = await supabaseAdmin
      .from('questions')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', newQuestion.id)

    if (updateError) {
      // The session exists and is usable -- log this but don't fail the
      // request over it. Reconciliation can still find the row by scanning
      // recent awaiting_payment rows if this write is ever lost.
      await logError('stripe/create-checkout:session-id-update', updateError, {
        questionId: newQuestion.id,
        sessionId: session.id,
      })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    // Stripe never returned a usable session -- this row would otherwise
    // sit as an orphaned awaiting_payment record with nothing to confirm
    // it. Clean it up now rather than waiting on reconciliation.
    await supabaseAdmin.from('questions').delete().eq('id', newQuestion.id)
    await logError('stripe/create-checkout', err, { expertId, username })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
