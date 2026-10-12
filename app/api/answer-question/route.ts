import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { logError } from '@/lib/log-error'

// Saves an expert's answer. It is refused once the response window has run
// out: until the nightly job expires the question the row still says pending,
// and the asker was promised they are only charged for an answer given in time.
// The status and deadline are checked in the same update that saves the
// answer, so a late answer can't slip in between a check and the save.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  let body: { questionId?: unknown; answerText?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.questionId !== 'string' || typeof body.answerText !== 'string') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (body.answerText.trim().length === 0) {
    return NextResponse.json({ error: 'Please write an answer first.' }, { status: 400 })
  }

  // answered_at is set by a database trigger when the status changes.
  const { data: saved, error } = await supabaseAdmin
    .from('questions')
    .update({ answer_text: body.answerText, status: 'answered' })
    .eq('id', body.questionId)
    .eq('expert_id', user.id)
    .eq('status', 'pending')
    .gt('deadline_at', new Date().toISOString())
    .select('id')

  if (error) {
    await logError('answer-question', error, { questionId: body.questionId, expertId: user.id })
    return NextResponse.json({ error: 'Could not save your answer. Please try again.' }, { status: 500 })
  }

  if (!saved || saved.length === 0) {
    const { data: current } = await supabaseAdmin
      .from('questions')
      .select('status')
      .eq('id', body.questionId)
      .eq('expert_id', user.id)
      .maybeSingle()
    if (!current) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    }
    return NextResponse.json(
      {
        error:
          current.status === 'pending' || current.status === 'expired'
            ? 'The response time for this question has passed, so it can’t be answered. The asker isn’t charged.'
            : 'This question has already been handled.',
        expired: current.status === 'pending' || current.status === 'expired',
      },
      { status: 409 }
    )
  }

  return NextResponse.json({ success: true })
}
