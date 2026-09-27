import { supabaseAdmin } from './supabase-admin'
import { logError } from './log-error'
import { sendNewQuestionEmail } from './send-new-question-email'

// Shared by the Stripe webhook (fast path) and the reconciliation cron
// (eventual-consistency backstop) -- both need the exact same idempotent
// transition, so a duplicate call from either one is always a no-op.
export async function confirmQuestionPayment({
  questionId,
  paymentIntentId,
}: {
  questionId: string
  paymentIntentId: string | null | undefined
}) {
  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('id, expert_id, question_text, price_cents')
    .eq('id', questionId)
    .maybeSingle()

  if (!question) {
    await logError('confirm-question-payment', new Error('Question not found'), {
      questionId,
    })
    return
  }

  const { data: expert } = await supabaseAdmin
    .from('experts')
    .select('response_window_hours, email_notifications')
    .eq('id', question.expert_id)
    .maybeSingle()

  const deadline = new Date()
  deadline.setHours(deadline.getHours() + (expert?.response_window_hours ?? 24))

  // The status guard makes this idempotent: a second delivery of the same
  // Stripe event, or a reconciliation pass after the webhook already ran,
  // matches zero rows and does nothing further.
  const { data: updated, error } = await supabaseAdmin
    .from('questions')
    .update({
      status: 'pending',
      stripe_payment_intent_id: paymentIntentId ?? null,
      deadline_at: deadline.toISOString(),
    })
    .eq('id', questionId)
    .eq('status', 'awaiting_payment')
    .select('id')

  if (error) {
    await logError('confirm-question-payment:update', error, { questionId })
    return
  }

  if (!updated || updated.length === 0) {
    // Already confirmed by an earlier delivery/pass -- nothing left to do.
    return
  }

  if (expert?.email_notifications === false) {
    return
  }

  // Isolated from the transition above: a failure here must never affect
  // whether the question got confirmed.
  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      question.expert_id
    )
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', question.expert_id)
      .maybeSingle()

    const expertEmail = authUser?.user?.email
    if (expertEmail) {
      await sendNewQuestionEmail({
        expertEmail,
        expertFirstName: profile?.full_name?.split(' ')[0] || 'there',
        questionText: question.question_text,
        priceCents: question.price_cents ?? 0,
      })
    }
  } catch (notifyErr) {
    await logError('confirm-question-payment:notification', notifyErr, {
      questionId,
    })
  }
}
