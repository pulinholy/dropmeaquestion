import { resend } from './resend'
import { renderEmailLayout, renderEmailButton, EMAIL_BASE_URL } from './email-layout'
import { logError } from './log-error'

// Names and headlines are typed by the person registering, so they are
// escaped before going into the email's HTML.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Who hears about new experts: NEW_EXPERT_ALERT_EMAILS if set, otherwise the
// admins in ADMIN_EMAILS. Comma separated.
function alertRecipients(): string[] {
  const raw = process.env.NEW_EXPERT_ALERT_EMAILS || process.env.ADMIN_EMAILS || ''
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
}

export async function sendNewExpertAlert({
  fullName,
  username,
  email,
  headline,
  priceCents,
  responseWindowHours,
  topics,
}: {
  fullName: string
  username: string
  email: string | null
  headline: string | null
  priceCents: number
  responseWindowHours: number
  topics: string[]
}) {
  const to = alertRecipients()
  if (to.length === 0) return

  const pageUrl = `${EMAIL_BASE_URL}/${username}`
  const rows: [string, string][] = [
    ['Name', fullName],
    ['Page', `${EMAIL_BASE_URL.replace(/^https?:\/\//, '')}/${username}`],
    ['Email', email ?? 'unknown'],
    ['Headline', headline || 'none'],
    ['Topics', topics.length ? topics.join(', ') : 'none'],
    ['Price', `$${(priceCents / 100).toFixed(2)}`],
    ['Response window', `${responseWindowHours} hours`],
  ]

  const body = `
    <p style="margin:0 0 16px;">A new expert just registered on Drop Me A Question.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px; font-size:14px;">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:4px 16px 4px 0; color:#4a5568;">${label}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`
        )
        .join('')}
    </table>
    ${renderEmailButton(pageUrl, 'View their page &rarr;')}
  `

  try {
    const { error } = await resend.emails.send({
      from: 'Drop Me A Question <hello@dropmeaquestion.com>',
      to,
      subject: `New expert: ${fullName} (@${username})`,
      html: renderEmailLayout(body),
    })
    if (error) await logError('send-new-expert-alert:resend', error, { username })
  } catch (err) {
    await logError('send-new-expert-alert', err, { username })
  }
}
