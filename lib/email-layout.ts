// Emails are always opened from a real inbox, never from the machine that
// triggered the send -- so this must be a publicly reachable URL even when
// NEXT_PUBLIC_SITE_URL is set to localhost for local dev checkout testing.
export const EMAIL_BASE_URL = process.env.EMAIL_BASE_URL || 'https://www.dropmeaquestion.com'
const SITE_URL = EMAIL_BASE_URL

// Table-based layout with inline styles throughout -- email clients (Outlook
// especially) don't reliably support flexbox/grid or external stylesheets.
export function renderEmailLayout(bodyHtml: string): string {
  const year = new Date().getFullYear()

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f8f6f1;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f6f1;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
            <tr>
              <td style="background-color:#e45b4f; height:4px; line-height:4px; font-size:1px;">&nbsp;</td>
            </tr>
            <tr>
              <td align="center" style="padding: 28px 24px 12px;">
                <a href="${SITE_URL}" style="text-decoration:none;">
                  <img src="${SITE_URL}/brand/logo-lockup.png" alt="Drop Me A Question" height="32" style="display:block; border:0;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff; border:1px solid #ddd6c8; border-radius:6px; padding: 28px 24px; font-family: Georgia, 'Times New Roman', serif; color:#17243a; font-size:15px; line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 24px 16px 4px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color:#4a5568;">
                <a href="${SITE_URL}/terms" style="color:#4a5568; text-decoration:underline;">Terms of Service</a>
                &nbsp;&middot;&nbsp;
                <a href="${SITE_URL}/privacy" style="color:#4a5568; text-decoration:underline;">Privacy Policy</a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 4px 16px 24px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color:#4a5568;">
                &copy; ${year} Drop Me A Question
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`
}

// Bulletproof-ish pill button: a colored <td> wrapping the link, rather than
// relying on border-radius on the <a> itself (unreliable in Outlook desktop).
export function renderEmailButton(url: string, label: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 4px 0 0;">
  <tr>
    <td style="border-radius:999px; background-color:#e45b4f;">
      <a href="${url}" style="display:inline-block; padding:10px 22px; font-family: Arial, Helvetica, sans-serif; font-size:13px; font-weight:bold; color:#f8f6f1; text-decoration:none; border-radius:999px;">
        ${label}
      </a>
    </td>
  </tr>
</table>
`
}

export function renderEmailQuote(text: string): string {
  return `<blockquote style="margin:0 0 20px; padding:12px 16px; background-color:#f8f6f1; border-left:3px solid #ddd6c8; color:#4a5568; font-style:italic;">${text}</blockquote>`
}
