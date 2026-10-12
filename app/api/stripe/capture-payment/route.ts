import { NextResponse } from 'next/server'
import { captureQuestionPayment } from '@/lib/stripe-capture'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { logError } from '@/lib/log-error'
import { parseUtcDate } from '@/lib/question-deadline'

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
    .select('expert_id, status, answered_at, deadline_at, stripe_payment_intent_id')
    .eq('id', questionId)
    .maybeSingle()

  if (!question || question.expert_id !== user.id) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Only an answered question is charged. This also keeps a question that
  // has expired (or was declined) from ever being captured.
  if (question.status !== 'answered') {
    return NextResponse.json({ error: 'This question has not been answered.' }, { status: 409 })
  }

  // Charged only if the answer was given within the response time. The time
  // it was answered comes from the database (set when the status changed), not
  // from anyone's browser, so a late answer saved some other way can't be
  // charged either.
  if (
    question.answered_at &&
    question.deadline_at &&
    parseUtcDate(question.answered_at).getTime() > parseUtcDate(question.deadline_at).getTime()
  ) {
    return NextResponse.json(
      { error: 'The response time had passed when this was answered, so the asker is not charged.' },
      { status: 409 }
    )
  }

  if (!question.stripe_payment_intent_id) {
    return NextResponse.json({ error: 'No payment intent on this question' }, { status: 400 })
  }

  // Safe to repeat: a payment that was already taken counts as done, and brief
  // trouble reaching Stripe is retried. If it still fails, the nightly job tries
  // again while the hold is certainly valid.
  const result = await captureQuestionPayment(question.stripe_payment_intent_id)
  if (!result.ok) {
    await logError('stripe/capture-payment', new Error(result.detail), {
      questionId,
      expertId: user.id,
      reason: result.reason,
    })
    return NextResponse.json(
      { error: 'The payment could not be completed yet.', retrying: result.reason === 'stripe_error' },
      { status: 502 }
    )
  }
  return NextResponse.json({ success: true })
}
