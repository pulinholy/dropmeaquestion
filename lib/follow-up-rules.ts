// Paid 15-minute follow-up conversations, offered only after an expert has
// answered a question. The decisions behind these numbers are in the
// follow-up call design notes.

export const FOLLOW_UP_DURATION_MINUTES = 15
// How long after the answer the asker can still book.
export const FOLLOW_UP_OFFER_DAYS = 14
export const FOLLOW_UP_MIN_NOTICE_HOURS = 24
// Latest start time that can be requested. Four days, not more: scheduled
// jobs only run daily, so settling a call can run up to a day late, and the
// card hold has to outlast that (see usableSlotsForHold).
export const FOLLOW_UP_MAX_DAYS_AHEAD = 4
export const FOLLOW_UP_CONFIRM_HOURS = 24
export const FOLLOW_UP_MAX_SLOTS = 3
export const FOLLOW_UP_PLATFORM_FEE_RATE = 0.15
// A call can only be proposed if its end plus this margin falls before the
// card hold expires, leaving room for a daily job to capture or release it.
export const FOLLOW_UP_SETTLE_MARGIN_HOURS = 48
// Shortest hold Stripe documents for online cards (Visa merchant-initiated,
// 4 days 18 hours); used only if Stripe doesn't report capture_before.
export const FOLLOW_UP_FALLBACK_HOLD_HOURS = 4 * 24 + 18

// Bump when the wording below changes; it's stored with each booking so a
// dispute can show exactly what the asker agreed to.
export const FOLLOW_UP_POLICY_VERSION = '2026-10-v1'

export const FOLLOW_UP_POLICY_LINES = [
  'Your card is held when you request the conversation. You are charged only after it takes place.',
  'The expert has 24 hours to confirm a time. If they decline or don’t respond, your hold is released and you are not charged.',
  'You can cancel for free until 24 hours before the conversation. Cancelling later, or not joining, is charged in full.',
  'If the expert cancels or doesn’t join, you are not charged.',
]

export const FOLLOW_UP_PRIVACY_LINES = [
  'Your email address isn’t shared by Drop Me A Question.',
  'The conversation takes place using the expert’s video meeting service. Information from your meeting profile, such as your display name, may be visible during the conversation.',
]

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

// Checks the times an asker proposed: 1-3 distinct start times on a 15-minute
// grid, between 24 hours and 4 days from now. Returns them normalised, in order.
export function validateProposedSlots(
  raw: unknown,
  now: Date = new Date()
): { ok: true; slots: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > FOLLOW_UP_MAX_SLOTS) {
    return { ok: false, error: `Propose between 1 and ${FOLLOW_UP_MAX_SLOTS} times.` }
  }

  const earliest = now.getTime() + FOLLOW_UP_MIN_NOTICE_HOURS * 3600 * 1000
  const latest = now.getTime() + FOLLOW_UP_MAX_DAYS_AHEAD * 24 * 3600 * 1000
  const quarter = FOLLOW_UP_DURATION_MINUTES * 60 * 1000
  const times = new Set<number>()

  for (const value of raw) {
    if (typeof value !== 'string' || !ISO_UTC.test(value)) {
      return { ok: false, error: 'One of the times isn’t valid.' }
    }
    const t = new Date(value).getTime()
    if (Number.isNaN(t) || t % quarter !== 0) {
      return { ok: false, error: 'Times must start on the quarter hour.' }
    }
    if (t < earliest) {
      return {
        ok: false,
        error: `Choose times at least ${FOLLOW_UP_MIN_NOTICE_HOURS} hours from now.`,
      }
    }
    if (t > latest) {
      return {
        ok: false,
        error: `Choose times within the next ${FOLLOW_UP_MAX_DAYS_AHEAD} days.`,
      }
    }
    times.add(t)
  }

  if (times.size !== raw.length) {
    return { ok: false, error: 'Each proposed time must be different.' }
  }

  return {
    ok: true,
    slots: [...times].sort((a, b) => a - b).map((t) => new Date(t).toISOString()),
  }
}

// Which proposed times can still be charged in time, given when the card
// hold expires. A call must end, and a daily job then capture or release it,
// before the hold lapses -- otherwise the expert could go unpaid.
export function usableSlotsForHold(
  slots: string[],
  captureBefore: Date,
  now: Date = new Date()
): string[] {
  const duration = FOLLOW_UP_DURATION_MINUTES * 60 * 1000
  const margin = FOLLOW_UP_SETTLE_MARGIN_HOURS * 3600 * 1000
  const soonest = now.getTime() + 2 * 3600 * 1000

  return slots.filter((slot) => {
    const start = new Date(slot).getTime()
    return start >= soonest && start + duration + margin <= captureBefore.getTime()
  })
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatPrice(priceCents: number): string {
  const dollars = priceCents / 100
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2)
}

export function formatSlot(iso: string, timeZone: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timeZone || 'UTC',
      timeZoneName: 'short',
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toUTCString()
  }
}
