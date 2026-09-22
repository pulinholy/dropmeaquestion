import { NextResponse } from 'next/server'
import { resend } from '@/lib/resend'

export async function POST(request: Request) {
  const { askerEmail, questionText, answerText, expertName, questionId } = await request.json()

  if (!askerEmail || !answerText) {
    return NextResponse.json({ error: 'Missing askerEmail or answerText' }, { status: 400 })
  }

  const expertFirstName = expertName?.split(' ')[0] || expertName
  const feedbackUrl = questionId
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/feedback/${questionId}`
    : null

  try {
    const { data, error } = await resend.emails.send({
      from: 'Drop Me A Question <hello@dropmeaquestion.com>',
      to: askerEmail,
      subject: `${expertFirstName} answered your question`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>${expertFirstName} answered the question you dropped:</p>
          <blockquote style="border-left: 3px solid #ddd; margin: 16px 0; padding-left: 12px; color: #555;">
            ${questionText}
          </blockquote>
          <p style="white-space: pre-wrap;">${answerText}</p>
          ${feedbackUrl ? `<p style="margin-top: 24px;"><a href="${feedbackUrl}" style="color: #e45b4f;">Was this helpful? Let ${expertFirstName} know &rarr;</a></p>` : ''}
          <p style="margin-top: 32px; font-size: 13px; color: #888;">Sent via Drop Me A Question</p>
        </div>
      `,
    })

    if (error) {
      console.error('Resend rejected the email:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err) {
    console.error('Failed to send answer email:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
