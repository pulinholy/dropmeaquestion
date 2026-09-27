import { resend } from './resend'
import { renderEmailLayout, renderEmailButton, renderEmailQuote, EMAIL_BASE_URL } from './email-layout'
import { logError } from './log-error'

export async function sendNewQuestionEmail({
  expertEmail,
  expertFirstName,
  questionText,
  priceCents,
}: {
  expertEmail: string
  expertFirstName: string
  questionText: string
  priceCents: number
}) {
  const price = (priceCents / 100).toFixed(2)
  const dashboardUrl = `${EMAIL_BASE_URL}/dashboard/questions/pending`

  const body = `
    <p style="margin:0 0 16px;">Hi ${expertFirstName}, you&rsquo;ve got a new question on Drop Me A Question &mdash; worth $${price}.</p>
    ${renderEmailQuote(questionText)}
    <p style="margin:0 0 24px;">Answer within your response window to get paid.</p>
    ${renderEmailButton(dashboardUrl, 'Answer now &rarr;')}
  `

  try {
    const { error } = await resend.emails.send({
      from: 'Drop Me A Question <hello@dropmeaquestion.com>',
      to: expertEmail,
      subject: `You've got a new question — $${price}`,
      html: renderEmailLayout(body),
    })

    if (error) {
      await logError('send-new-question-email:resend', error, { expertEmail })
    }
  } catch (err) {
    await logError('send-new-question-email', err, { expertEmail })
  }
}
