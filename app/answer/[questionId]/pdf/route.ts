import { supabaseAdmin } from '@/lib/supabase-admin'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'
import { renderAnswerPdf } from '@/lib/answer-pdf'
import { loadExpertLetterInfo } from '@/lib/answer-letter'
import { normalizeSignature } from '@/lib/answer-signature'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function notFound(): Response {
  return new Response('This link isn’t valid.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// The asker's copy of an answer, opened from the "View & download your answer"
// button in the answer email. Like the feedback page, the link is the question's
// own unguessable id, so askers don't need an account. It never contains the
// asker's email address, and only answered questions have one.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params
  if (!UUID.test(questionId)) return notFound()

  // Each request builds a document, so a link can't be hammered.
  const limited = await enforceRateLimit(request, [
    { name: 'answer-pdf', limit: 60, windowSeconds: 3600 },
  ])
  if (limited) return limited

  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('expert_id, status, question_text, answer_text, reference_id, answered_at')
    .eq('id', questionId)
    .maybeSingle()
  if (!question || question.status !== 'answered' || !question.answer_text) return notFound()

  try {
    const info = await loadExpertLetterInfo(question.expert_id)

    // The signature as it was when the answer was sent, so editing it later
    // doesn't change answers people already have. Older answers, and any sent
    // before the database had the column, use the expert's current one.
    const { data: snapshot } = await supabaseAdmin
      .from('questions')
      .select('answer_signature')
      .eq('id', questionId)
      .maybeSingle()
    const signature = normalizeSignature(snapshot?.answer_signature, info.signature)

    const pdf = await renderAnswerPdf({
      expertName: info.fullName,
      expertHeadline: info.headline,
      question: question.question_text,
      answer: question.answer_text,
      signature,
      referenceId: question.reference_id,
      answeredAt: question.answered_at ? new Date(question.answered_at) : null,
    })

    const safeName = info.fullName.replace(/[^A-Za-z0-9 _-]+/g, '').trim() || 'Expert'
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Answer from ${safeName}.pdf"`,
        'Cache-Control': 'private, max-age=300',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  } catch (err) {
    await logError('answer-pdf', err, { questionId })
    return new Response('We couldn’t build this document right now. Please try again in a moment.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
}
