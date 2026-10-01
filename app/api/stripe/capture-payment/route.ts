import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { logError } from '@/lib/log-error'

export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const { questionId } = await request.json()
  if (typeof questionId !== 'string') {
    return NextResponse.json({ error: 'Missing questionId' }, { status: 400 })
  }

  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('expert_id, stripe_payment_intent_id')
    .eq('id', questionId)
    .maybeSingle()

  if (!question || question.expert_id !== user.id) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  if (!question.stripe_payment_intent_id) {
    return NextResponse.json({ error: 'No payment intent on this question' }, { status: 400 })
  }

  try {
    await stripe.paymentIntents.capture(question.stripe_payment_intent_id)
    return NextResponse.json({ success: true })
  } catch (err) {
    await logError('stripe/capture-payment', err, { questionId, expertId: user.id })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
