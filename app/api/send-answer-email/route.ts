import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import { renderEmailLayout, renderEmailButton, renderEmailQuote, EMAIL_BASE_URL } from '@/lib/email-layout'
import { logError } from '@/lib/log-error'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'

export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const { questionId } = await request.json()
  if (typeof questionId !== 'string') {
    return NextResponse.json({ error: 'Missing questionId' }, { status: 400 })
  }

  // Looked up server-side, never trusted from the client -- the expert's
  // browser must never hold the asker's email address at all, and the
  // content sent must be exactly what's stored, not whatever the request
  // body claims.
  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('expert_id, asker_email, question_text, answer_text')
    .eq('id', questionId)
    .maybeSingle()

  if (!question || question.expert_id !== user.id) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  const askerEmail = question.asker_email
  if (!askerEmail) {
    await logError('send-answer-email:lookup', new Error('Question missing asker_email'), { questionId })
    return NextResponse.json({ error: 'Could not find the question to notify' }, { status: 404 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const expertName = profile?.full_name || 'Your expert'
  const expertFirstName = expertName.split(' ')[0]
  const feedbackUrl = `${EMAIL_BASE_URL}/feedback/${questionId}`

  const body = `
    <p style="margin:0 0 16px;">${expertFirstName} answered the question you dropped:</p>
    ${renderEmailQuote(question.question_text)}
    <p style="margin:0 0 24px; white-space:pre-wrap;">${question.answer_text}</p>
    ${renderEmailButton(feedbackUrl, `Was this helpful? Let ${expertFirstName} know &rarr;`)}
  `

  try {
    const { data, error } = await resend.emails.send({
      from: 'Drop Me A Question <hello@dropmeaquestion.com>',
      to: askerEmail,
      subject: `${expertFirstName} answered your question`,
      html: renderEmailLayout(body),
    })

    if (error) {
      await logError('send-answer-email:resend', error, { askerEmail, questionId })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err) {
    await logError('send-answer-email', err, { askerEmail, questionId })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
