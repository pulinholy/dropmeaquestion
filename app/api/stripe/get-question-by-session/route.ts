import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'No payment found for this session' }, { status: 400 })
    }

    const { data: question } = await supabaseAdmin
      .from('questions')
      .select('id, question_text, expert_id, attachment_path')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle()

    if (!question) {
      // The Stripe webhook may not have finished creating the row yet
      return NextResponse.json({ pending: true })
    }

    const { data: expert } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', question.expert_id)
      .maybeSingle()

    return NextResponse.json({
      pending: false,
      questionId: question.id,
      questionText: question.question_text,
      expertName: expert?.full_name ?? 'the expert',
      hasAttachment: Boolean(question.attachment_path),
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
