import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'
import { renderEmailLayout, renderEmailButton, renderEmailQuote, EMAIL_BASE_URL } from '@/lib/email-layout'
import { logError } from '@/lib/log-error'

export async function POST(request: Request) {
  const { askerEmail, questionText, answerText, expertName, questionId } = await request.json()

  if (!askerEmail || !answerText) {
    return NextResponse.json({ error: 'Missing askerEmail or answerText' }, { status: 400 })
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
