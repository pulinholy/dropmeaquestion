// Help an expert set up how askers write their question: a short note on what
// to include, and optional starter text that pre-fills the question box. The
// question itself stays one block of text, so everything downstream (the
// dashboard, the answer email, payments) works exactly as before.

export const GUIDANCE_MAX = 300
export const STARTER_MAX = 400

export type QuestionTemplate = {
  id: string
  label: string
  guidance: string
  starter: string
}

export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  {
    id: 'career-coach',
    label: 'Career coach',
    guidance:
      "Tell me your role, what you've tried, and the decision you're facing. The more specific, the better my answer.",
    starter: "My role:\nWhat I've tried:\nThe decision I'm facing:",
  },
  {
    id: 'designer',
    label: 'Designer',
    guidance:
      "Describe what you're designing, who it's for, and where you're stuck. Mention any limits, such as time or tools.",
    starter: "What I'm designing:\nWho it's for:\nWhere I'm stuck:",
  },
  {
    id: 'developer',
    label: 'Developer',
    guidance:
      "Share your stack, what you expected, and what happens instead. Include any error message, but leave out passwords and keys.",
    starter: "My stack:\nWhat I'm trying to do:\nWhat happens instead:",
  },
  {
    id: 'consultant',
    label: 'Consultant',
    guidance:
      'Describe your business, the challenge, and what a good outcome would look like.',
    starter: 'My business:\nThe challenge:\nWhat success looks like:',
  },
]

// One form of line endings and no stray spaces, so two texts can be compared.
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
}

// Links, email addresses and phone numbers are not allowed in an expert's
// guidance or starter text: it keeps askers' and experts' contact details
// private and stops people being steered off DMQ.
export function hasLinkOrContact(text: string): boolean {
  if (/(https?:\/\/|www\.)/i.test(text)) return true
  if (/\b[\w-]+\.(com|net|org|io|co|app|dev|me|us|ai|info|biz)\b/i.test(text)) return true
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) return true
  if (/\+?\d[\d\s().-]{7,}\d/.test(text)) return true
  return false
}

export type TextCheck = { ok: true; text: string } | { ok: false; message: string }

export function checkQuestionFormText(raw: string, max: number, name: string): TextCheck {
  const text = normalizeText(raw)
  if (text.length > max) {
    return { ok: false, message: `${name} can be up to ${max} characters.` }
  }
  if (hasLinkOrContact(text)) {
    return {
      ok: false,
      message: `${name} can't include links, email addresses, or phone numbers.`,
    }
  }
  return { ok: true, text }
}

// True when the asker is about to send the starter text exactly as it was
// filled in for them, with none of their own details added.
export function isUnchangedStarter(question: string, starter: string | null | undefined): boolean {
  if (!starter) return false
  const base = normalizeText(starter)
  return base.length > 0 && normalizeText(question) === base
}
