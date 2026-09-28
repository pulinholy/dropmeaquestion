import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import { renderEmailLayout, renderEmailButton, renderEmailQuote, EMAIL_BASE_URL } from '@/lib/email-layout'
import { logError } from '@/lib/log-error'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const { questionText, answerText, expertName, questionId } = await request.json()

  if (!questionId || !answerText) {
    return NextResponse.json({ error: 'Missing questionId or answerText' }, { status: 400 })
  }

  // Looked up server-side, never trusted from the client -- the expert's
  // browser must never hold the asker's email address at all.
  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('asker_email')
    .eq('id', questionId)
    .maybeSingle()

  const askerEmail = question?.asker_email
  if (!askerEmail) {
    await logError('send-answer-email:lookup', new Error('Question not found or missing asker_email'), { questionId })
    return NextResponse.json({ error: 'Could not find the question to notify' }, { status: 404 })
  }

  const expertFirstName = expertName?.split(' ')[0] || expertName
  const feedbackUrl = questionId
    ? `${EMAIL_BASE_URL}/feedback/${questionId}`
    : null

  const body = `
    <p style="margin:0 0 16px;">${expertFirstName} answered the question you dropped:</p>
    ${renderEmailQuote(questionText)}
    <p style="margin:0 0 24px; white-space:pre-wrap;">${answerText}</p>
    ${feedbackUrl ? renderEmailButton(feedbackUrl, `Was this helpful? Let ${expertFirstName} know &rarr;`) : ''}
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
