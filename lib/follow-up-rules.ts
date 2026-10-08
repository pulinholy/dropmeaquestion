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
export const FOLLOW_UP_POLICY_VERSION = '2026-10-v3'

export const FOLLOW_UP_POLICY_LINES = [
  'Your card is held when you request the conversation. You are charged only after it takes place.',
  'The expert has 24 hours to confirm a time. If they decline or don’t respond, your hold is released and you are not charged.',
  'You can cancel for free until 24 hours before the conversation. Cancelling later, or not joining, is charged in full, unless something went wrong on our side or the expert’s. Tell us within 24 hours and we’ll review it.',
  'If the expert cancels or doesn’t join, you are not charged. If a connection problem stops the conversation, report it and we’ll review it.',
  'After the conversation we’ll ask you to confirm it took place. If you report a problem, we hold the charge and review it. If we don’t hear from you, your card is charged about a day after it ends.',
  'The conversation is the expert’s own opinion. A conversation that didn’t take place isn’t charged, but disagreeing with the advice isn’t a reason for a refund.',
]

export const FOLLOW_UP_PRIVACY_LINES = [
  'Your email address isn’t shared by Drop Me A Question.',
  'The conversation takes place using the expert’s video meeting service. Information from your meeting profile, such as your display name, may be visible during the conversation.',
]

// ---- Wording for DMQ-hosted conversations ---------------------------------
// With DMQ-hosted rooms switched off these return exactly the lines above, so
// nothing changes until the switch is on.

export type FollowUpVideoMode = 'dmq' | 'external'

export const FOLLOW_UP_POLICY_VERSION_DMQ = '2026-10-v4-dmq'

export function followUpPolicyVersion(mode: FollowUpVideoMode): string {
  return mode === 'dmq' ? FOLLOW_UP_POLICY_VERSION_DMQ : FOLLOW_UP_POLICY_VERSION
}

export function followUpPolicyLines(mode: FollowUpVideoMode): string[] {
  if (mode !== 'dmq') return FOLLOW_UP_POLICY_LINES
  return [
    ...FOLLOW_UP_POLICY_LINES,
    'The conversation lasts 15 minutes from the scheduled start. The room stays open for 5 minutes after that, then closes.',
  ]
}

export function followUpPrivacyLines(mode: FollowUpVideoMode): string[] {
  if (mode !== 'dmq') return FOLLOW_UP_PRIVACY_LINES
  return [
    'Your email address isn’t shared by Drop Me A Question.',
    'The conversation takes place on Drop Me A Question as an audio call with an optional camera. You appear as “Guest”, and it isn’t recorded. Our video provider handles the call. If the expert chooses their own video meeting link instead, you’ll be told, and your meeting profile’s display name may be visible.',
  ]
}

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

// The join button unlocks shortly before the start, so nobody stresses about
// joining a couple of minutes early, and closes a while after the start for
// late arrivals and overruns.
export const FOLLOW_UP_JOIN_OPENS_MINUTES_BEFORE = 10
export const FOLLOW_UP_JOIN_CLOSES_MINUTES_AFTER = 30

export function joinWindowFor(confirmedStartIso: string): { opensAt: Date; closesAt: Date } {
  const start = new Date(confirmedStartIso).getTime()
  return {
    opensAt: new Date(start - FOLLOW_UP_JOIN_OPENS_MINUTES_BEFORE * 60 * 1000),
    closesAt: new Date(start + FOLLOW_UP_JOIN_CLOSES_MINUTES_AFTER * 60 * 1000),
  }
}

// DMQ-hosted rooms: open 10 minutes before the scheduled start; the clock runs
// from the scheduled start, not from when each person joins; and the room
// closes 5 minutes after the 15-minute slot so nobody is cut off mid-sentence.
export const FOLLOW_UP_VIDEO_GRACE_MINUTES = 5

export function videoRoomWindowFor(confirmedStartIso: string): {
  opensAt: Date
  scheduledEnd: Date
  closesAt: Date
} {
  const start = new Date(confirmedStartIso).getTime()
  const scheduledEnd = start + FOLLOW_UP_DURATION_MINUTES * 60 * 1000
  return {
    opensAt: new Date(start - FOLLOW_UP_JOIN_OPENS_MINUTES_BEFORE * 60 * 1000),
    scheduledEnd: new Date(scheduledEnd),
    closesAt: new Date(scheduledEnd + FOLLOW_UP_VIDEO_GRACE_MINUTES * 60 * 1000),
  }
}

export function isJoinWindowOpen(confirmedStartIso: string, now: Date = new Date()): boolean {
  const { opensAt, closesAt } = joinWindowFor(confirmedStartIso)
  return now >= opensAt && now <= closesAt
}

// Meeting links are sent to askers, so only well-known video services are
// accepted -- an expert can't point someone at an arbitrary website. Matches
// the host exactly or as a subdomain (us02web.zoom.us), never as a lookalike
// (evil-zoom.us, zoom.us.evil.com).
const ALLOWED_MEETING_DOMAINS = [
  'zoom.us',
  'meet.google.com',
  'teams.microsoft.com',
  'teams.live.com',
  'webex.com',
  'whereby.com',
]

export const ALLOWED_MEETING_SERVICES_TEXT =
  'Zoom, Google Meet, Microsoft Teams, Webex or Whereby'

export function isAllowedMeetingLink(
  raw: unknown
): { ok: true; url: string } | { ok: false; error: string } {
  const invalid = {
    ok: false as const,
    error: `Paste a meeting link from ${ALLOWED_MEETING_SERVICES_TEXT} (it must start with https://).`,
  }
  if (typeof raw !== 'string') return invalid
  const text = raw.trim()
  if (text.length === 0 || text.length > 500) return invalid

  let url: URL
  try {
    url = new URL(text)
  } catch {
    return invalid
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port) return invalid

  const host = url.hostname.toLowerCase()
  const allowed = ALLOWED_MEETING_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  )
  if (!allowed) return invalid

  return { ok: true, url: url.toString() }
}

// ---- Cancellation, no-show and settlement rules ---------------------------

export const FOLLOW_UP_FREE_CANCEL_HOURS = 24
// A confirmed call nobody settled is settled automatically this long after it
// was due to end.
export const FOLLOW_UP_AUTO_SETTLE_HOURS_AFTER_END = 24
// An expert can only report "the asker didn't join" once the slot has fully
// elapsed, so a slightly late asker isn't charged.
export const FOLLOW_UP_NO_SHOW_AFTER_MINUTES = FOLLOW_UP_DURATION_MINUTES

// What cancelling now means for the asker.
//  free    -> hold released, no charge
//  late    -> charged in full (inside the 24-hour window)
//  started -> too late to cancel; the call time has begun
export function cancellationKind(
  confirmedStartIso: string,
  now: Date = new Date()
): 'free' | 'late' | 'started' {
  const start = new Date(confirmedStartIso).getTime()
  if (now.getTime() >= start) return 'started'
  const hoursLeft = (start - now.getTime()) / 3600000
  return hoursLeft >= FOLLOW_UP_FREE_CANCEL_HOURS ? 'free' : 'late'
}

// What happens to a confirmed call nobody settled, from who actually opened
// the join page. Only the asker can't reach the meeting without our button, so
// "asker never joined" is solid evidence; "expert never joined" is not (they
// have the link themselves), so that case goes to a person.
export type AutoSettlement = 'completed' | 'asker_no_show' | 'needs_review' | 'neither_joined'

export function autoSettlementFor(joined: {
  asker: boolean
  expert: boolean
}): AutoSettlement {
  if (joined.asker && joined.expert) return 'completed'
  if (!joined.asker && joined.expert) return 'asker_no_show'
  if (joined.asker && !joined.expert) return 'needs_review'
  return 'neither_joined'
}

// Every way a confirmed conversation can end. Money: completed,
// late_cancelled and asker_no_show are charged in full; the cancelled /
// no-show / neither / admin_release outcomes are released with no charge;
// "disputed" stays held for a person to decide.
export type FollowUpOutcome =
  | 'completed'
  | 'late_cancelled'
  | 'asker_no_show'
  | 'cancelled_by_asker'
  | 'cancelled_by_expert'
  | 'expert_no_show'
  | 'neither_joined'
  | 'admin_release'
  | 'admin_release_expert_fault'
  | 'disputed'

// ---- Problem reports --------------------------------------------------------

export const FOLLOW_UP_PROBLEM_REASONS = ['no_show', 'link_failed', 'ended_early', 'other'] as const
export type FollowUpProblemReason = (typeof FOLLOW_UP_PROBLEM_REASONS)[number]
export const FOLLOW_UP_PROBLEM_NOTE_MAX = 500

// What each reason is called, from the point of view of whoever is reporting.
export function problemReasonLabel(
  reason: string,
  reportedBy: 'asker' | 'expert' | null
): string {
  switch (reason) {
    case 'no_show':
      return reportedBy === 'expert' ? "The asker didn't join" : "The expert didn't join"
    case 'link_failed':
      return "The meeting link didn't work"
    case 'ended_early':
      return 'The call ended early'
    case 'other':
      return 'Something else'
    default:
      return reason
  }
}

// Checks a problem report from the browser. The note is required for "other".
export function parseProblemReport(
  body: { reason?: unknown; note?: unknown }
): { ok: true; reason: FollowUpProblemReason; note: string | null } | { ok: false; error: string } {
  const reason = FOLLOW_UP_PROBLEM_REASONS.find((r) => r === body.reason)
  if (!reason) return { ok: false, error: 'Please choose what went wrong.' }

  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > FOLLOW_UP_PROBLEM_NOTE_MAX) {
    return { ok: false, error: `Please keep the note under ${FOLLOW_UP_PROBLEM_NOTE_MAX} characters.` }
  }
  if (reason === 'other' && note.length < 3) {
    return { ok: false, error: 'Please tell us a little about what happened.' }
  }
  return { ok: true, reason, note: note || null }
}

// The asker is emailed to confirm (or report) this long after the start, just
// after a 15-minute call would have ended.
export const FOLLOW_UP_REVIEW_EMAIL_MINUTES_AFTER_START = 20

// The asker can confirm "it took place" once the slot is over.
export function reviewOpensAt(confirmedStartIso: string): Date {
  return new Date(
    new Date(confirmedStartIso).getTime() + FOLLOW_UP_DURATION_MINUTES * 60 * 1000
  )
}

export function autoSettleDueAt(confirmedStartIso: string): Date {
  return new Date(
    new Date(confirmedStartIso).getTime() +
      (FOLLOW_UP_DURATION_MINUTES * 60 * 1000) +
      FOLLOW_UP_AUTO_SETTLE_HOURS_AFTER_END * 3600 * 1000
  )
}

// Reminder emails to schedule when a call is confirmed: 24 hours and 1 hour
// before, skipping any that would already be in the past (or about to be).
export function reminderTimesFor(
  confirmedStartIso: string,
  now: Date = new Date()
): { kind: '24h' | '1h'; at: string }[] {
  const start = new Date(confirmedStartIso).getTime()
  const slack = 10 * 60 * 1000
  const out: { kind: '24h' | '1h'; at: string }[] = []
  const dayBefore = start - 24 * 3600 * 1000
  const hourBefore = start - 3600 * 1000
  if (dayBefore >= now.getTime() + slack) out.push({ kind: '24h', at: new Date(dayBefore).toISOString() })
  if (hourBefore >= now.getTime() + slack) out.push({ kind: '1h', at: new Date(hourBefore).toISOString() })
  return out
}
