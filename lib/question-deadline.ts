// Supabase returns timestamp (no timezone) columns without a "Z" suffix,
// which the Date constructor would otherwise parse as local time instead
// of UTC. Force UTC interpretation when no timezone is present.
export function parseUtcDate(dateStr: string): Date {
  const hasTimezone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(dateStr)
  return new Date(hasTimezone ? dateStr : `${dateStr}Z`)
}

// Whether a question's response window has run out. The row itself only
// becomes "expired" when the nightly job runs, so screens use this to show
// the true state in the meantime.
export function isPastDeadline(deadlineAt: string, now: number = Date.now()): boolean {
  return parseUtcDate(deadlineAt).getTime() < now
}
