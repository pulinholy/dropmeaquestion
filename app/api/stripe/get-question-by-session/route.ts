import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  try {
    // The question already exists before payment, correlated by Stripe's own
    // (unguessable) checkout session id -- no need to call Stripe's API on
    // every poll just to find it.
    const { data: question } = await supabaseAdmin
      .from('questions')
      .select('id, status, question_text, expert_id, attachment_path, created_at')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()

    if (!question) {
      return NextResponse.json(
        { error: 'No question found for this session.' },
        { status: 400 }
      )
    }

    if (question.status === 'awaiting_payment') {
      return NextResponse.json({ pending: true })
    }

    if (question.status === 'payment_abandoned') {
      return NextResponse.json(
        { error: "We couldn't confirm this payment. Your card hasn't been charged." },
        { status: 400 }
      )
    }

    const { data: expert } = await supabaseAdmin
      .from('profiles')
      .select('full_name, username')
      .eq('id', question.expert_id)
      .maybeSingle()

    const { data: expertDetails } = await supabaseAdmin
      .from('experts')
      .select('response_window_hours')
      .eq('id', question.expert_id)
      .maybeSingle()

    return NextResponse.json({
      pending: false,
      questionId: question.id,
      questionText: question.question_text,
      expertName: expert?.full_name ?? 'the expert',
      expertUsername: expert?.username ?? null,
      responseWindowHours: expertDetails?.response_window_hours ?? null,
      hasAttachment: Boolean(question.attachment_path),
      askedAt: question.created_at,
    })
  } catch (err) {
    await logError('stripe/get-question-by-session', err, { sessionId })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
