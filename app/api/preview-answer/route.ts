import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'
import { renderAnswerPdf } from '@/lib/answer-pdf'
import { ANSWER_MAX_CHARS } from '@/lib/answer-limits'
import { loadExpertLetterInfo } from '@/lib/answer-letter'

// The "Preview & Send" step: builds the same PDF the asker will be able to
// download, from the answer as it is being written. Nothing is saved, charged
// or sent here, and only the question's own expert can ask for it.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'preview-answer', subject: user.id, limit: 120, windowSeconds: 3600 },
  ])
  if (limited) return limited

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
  if (body.answerText.length > ANSWER_MAX_CHARS) {
    return NextResponse.json(
      { error: `Answers can be up to ${ANSWER_MAX_CHARS.toLocaleString('en-US')} characters.` },
      { status: 400 }
    )
  }

  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('expert_id, status, question_text, reference_id')
    .eq('id', body.questionId)
    .maybeSingle()
  if (!question || question.expert_id !== user.id) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  }
  if (question.status !== 'pending') {
    return NextResponse.json({ error: 'This question has already been handled.' }, { status: 409 })
  }

  try {
    const info = await loadExpertLetterInfo(user.id)
    const pdf = await renderAnswerPdf({
      expertName: info.fullName,
      expertHeadline: info.headline,
      question: question.question_text,
      answer: body.answerText,
      signature: info.signature,
      referenceId: question.reference_id,
      answeredAt: new Date(),
    })
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="answer-preview.pdf"',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    await logError('preview-answer', err, { questionId: body.questionId, expertId: user.id })
    return NextResponse.json(
      { error: 'We couldn’t build the preview. Please try again.' },
      { status: 500 }
    )
  }
}
