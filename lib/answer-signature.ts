import { escapeHtml } from './follow-up-rules'

// The sign-off an expert puts under every answer: it appears at the end of the
// answer email and on the PDF. It is stored as a few plain fields, never as
// HTML, so nothing an expert types can add markup to an email or a document.

export const CLOSING_MAX = 60
export const SIGNATURE_NAME_MAX = 80
export const SIGNATURE_TITLE_MAX = 100

// A short, fixed palette keeps every signature readable on white. The hex
// values are what the email and the PDF both use.
export const SIGNATURE_COLORS = {
  coral: { label: 'Coral', hex: '#d4533f' },
  navy: { label: 'Navy', hex: '#17243a' },
  black: { label: 'Black', hex: '#111111' },
} as const

export type SignatureColor = keyof typeof SIGNATURE_COLORS

export type AnswerSignature = {
  closing: string
  name: string
  title: string
  boldName: boolean
  color: SignatureColor
}

export const DEFAULT_CLOSING = 'Best wishes,'

// What an expert who hasn't set anything up gets: their profile name under a
// friendly closing, so every answer has a sign-off from day one.
export function defaultSignature(fullName: string, headline?: string | null): AnswerSignature {
  return {
    closing: DEFAULT_CLOSING,
    name: fullName.trim().slice(0, SIGNATURE_NAME_MAX),
    title: (headline ?? '').trim().slice(0, SIGNATURE_TITLE_MAX),
    boldName: true,
    color: 'coral',
  }
}

// Single line, no control characters, trimmed to length.
function cleanLine(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

// Turns whatever is stored (or sent by a browser) into a safe signature.
// Missing or malformed fields fall back to the defaults, so an old or empty
// value never breaks an email.
export function normalizeSignature(
  raw: unknown,
  fallback: AnswerSignature
): AnswerSignature {
  if (!raw || typeof raw !== 'object') return fallback
  const r = raw as Record<string, unknown>
  const color =
    typeof r.color === 'string' && r.color in SIGNATURE_COLORS
      ? (r.color as SignatureColor)
      : fallback.color
  return {
    closing: cleanLine(r.closing, CLOSING_MAX) || fallback.closing,
    name: cleanLine(r.name, SIGNATURE_NAME_MAX) || fallback.name,
    title: 'title' in r ? cleanLine(r.title, SIGNATURE_TITLE_MAX) : fallback.title,
    boldName: typeof r.boldName === 'boolean' ? r.boldName : fallback.boldName,
    color,
  }
}

// For saving: the same rules as above, but says what is wrong instead of
// quietly fixing it, so the expert sees the problem on the page.
export function checkSignatureInput(
  raw: unknown
): { ok: true; signature: AnswerSignature } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: 'Invalid signature.' }
  }
  const r = raw as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' ? v : '')

  if (text(r.closing).length > CLOSING_MAX) {
    return { ok: false, message: `The closing message can be up to ${CLOSING_MAX} characters.` }
  }
  if (text(r.name).length > SIGNATURE_NAME_MAX) {
    return { ok: false, message: `The name can be up to ${SIGNATURE_NAME_MAX} characters.` }
  }
  if (text(r.title).length > SIGNATURE_TITLE_MAX) {
    return { ok: false, message: `The title can be up to ${SIGNATURE_TITLE_MAX} characters.` }
  }
  if (!cleanLine(r.name, SIGNATURE_NAME_MAX)) {
    return { ok: false, message: 'Please enter the name to sign with.' }
  }
  const blank = defaultSignature('')
  return { ok: true, signature: normalizeSignature(raw, blank) }
}

// The signature as email HTML, for the end of the answer. Everything is
// escaped, and the styling is inline like the rest of the email.
export function renderSignatureHtml(sig: AnswerSignature): string {
  const color = SIGNATURE_COLORS[sig.color].hex
  return `
    <div style="margin:18px 0 0;">
      <p style="margin:0 0 6px; font-size:15px; line-height:1.4;">${escapeHtml(sig.closing)}</p>
      <p style="margin:0; font-size:17px; line-height:1.3; font-style:italic; font-weight:${sig.boldName ? 'bold' : 'normal'}; color:${color};">${escapeHtml(sig.name)}</p>
      ${
        sig.title
          ? `<p style="margin:2px 0 0; font-family: Arial, Helvetica, sans-serif; font-size:12px; line-height:1.4; color:#4a5568;">${escapeHtml(sig.title)}</p>`
          : ''
      }
    </div>`
}
