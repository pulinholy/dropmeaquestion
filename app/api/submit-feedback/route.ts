import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_COMMENT_LENGTH = 500

export async function POST(request: Request) {
  const { questionId, rating, comment } = await request.json()

  if (typeof questionId !== 'string' || (rating !== 'up' && rating !== 'down')) {
    return NextResponse.json({ error: 'Invalid feedback.' }, { status: 400 })
  }

  if (typeof comment === 'string' && comment.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: `Comment is too long (max ${MAX_COMMENT_LENGTH} characters).` },
      { status: 400 }
    )
  }

  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('id, status, feedback_submitted_at')
    .eq('id', questionId)
    .maybeSingle()

  if (!question || question.status !== 'answered') {
    return NextResponse.json({ error: 'This feedback link is not valid.' }, { status: 404 })
  }

  if (question.feedback_submitted_at) {
    return NextResponse.json(
      { error: 'Feedback has already been submitted for this question.' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('questions')
    .update({
      feedback_rating: rating,
      feedback_comment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
      feedback_submitted_at: new Date().toISOString(),
    })
    .eq('id', questionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
