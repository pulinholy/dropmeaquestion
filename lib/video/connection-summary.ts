// Turns the provider's join/leave events into a per-conversation summary:
// who connected, how often, and for how long both were in the room together.
// Every time comes from the provider's signed server-side events, never from
// anything a browser reports. Pure, so it can be tested without a database.

export type VideoEventRow = {
  type: string
  user_id: string | null
  session_id: string | null
  // When the event happened (join time for "joined", leave time for "left").
  occurred_at: string | null
  // On a "left" event, when that session had joined (seconds since 1970).
  joined_at?: number | string | null
}

type Interval = [number, number]

export type RoleSummary = {
  joined: boolean
  // Still in the room as of the latest events.
  connected: boolean
  sessions: number
  reconnects: number
  totalSeconds: number
}

export type ConnectionSummary = {
  expert: RoleSummary
  asker: RoleSummary
  sharedSeconds: number
}

function roleOf(userId: string | null): 'expert' | 'asker' | null {
  if (!userId) return null
  if (userId.startsWith('expert')) return 'expert'
  if (userId.startsWith('asker')) return 'asker'
  return null
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const out: Interval[] = []
  for (const [start, end] of sorted) {
    const last = out[out.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else out.push([start, end])
  }
  return out
}

function overlapSeconds(a: Interval[], b: Interval[]): number {
  let total = 0
  for (const [aStart, aEnd] of a) {
    for (const [bStart, bEnd] of b) {
      const start = Math.max(aStart, bStart)
      const end = Math.min(aEnd, bEnd)
      if (end > start) total += end - start
    }
  }
  return Math.round(total / 1000)
}

export function summarizeConnections(
  events: VideoEventRow[],
  now: Date = new Date()
): ConnectionSummary {
  const bySession = new Map<string, VideoEventRow[]>()
  for (const e of events) {
    if (!e.session_id) continue
    const list = bySession.get(e.session_id) ?? []
    list.push(e)
    bySession.set(e.session_id, list)
  }

  const intervals: Record<'expert' | 'asker', Interval[]> = { expert: [], asker: [] }
  const sessions = { expert: 0, asker: 0 }
  const open = { expert: false, asker: false }

  for (const list of bySession.values()) {
    const joinedEvent = list.find((e) => e.type === 'participant.joined')
    const leftEvent = list.find((e) => e.type === 'participant.left')
    const role = roleOf((joinedEvent ?? leftEvent)?.user_id ?? null)
    if (!role) continue

    // A missing "joined" event (delivered late or lost) can still be rebuilt
    // from the join time carried on the "left" event.
    let start: number | null = null
    if (joinedEvent?.occurred_at) start = Date.parse(joinedEvent.occurred_at)
    else if (leftEvent?.joined_at != null) start = Number(leftEvent.joined_at) * 1000
    if (start === null || Number.isNaN(start)) continue

    let end: number
    if (leftEvent?.occurred_at) end = Date.parse(leftEvent.occurred_at)
    else {
      end = now.getTime()
      open[role] = true
    }
    if (end < start) continue

    intervals[role].push([start, end])
    sessions[role]++
  }

  const expert = mergeIntervals(intervals.expert)
  const asker = mergeIntervals(intervals.asker)
  const total = (iv: Interval[]) =>
    Math.round(iv.reduce((sum, [s, e]) => sum + (e - s), 0) / 1000)

  const summarize = (role: 'expert' | 'asker', iv: Interval[]): RoleSummary => ({
    joined: sessions[role] > 0,
    connected: open[role],
    sessions: sessions[role],
    reconnects: Math.max(0, sessions[role] - 1),
    totalSeconds: total(iv),
  })

  return {
    expert: summarize('expert', expert),
    asker: summarize('asker', asker),
    sharedSeconds: overlapSeconds(expert, asker),
  }
}

// The same summary, built from stored connection records (one row per
// connection) instead of raw events. A connection with no leave time is
// counted up to `capAt`, so a lost "left" event can't make someone present
// forever.
export function summarizeSessions(
  sessions: { role: string; joined_at: string; left_at: string | null }[],
  capAt: Date
): ConnectionSummary {
  const intervals: Record<'expert' | 'asker', Interval[]> = { expert: [], asker: [] }
  const count = { expert: 0, asker: 0 }
  const open = { expert: false, asker: false }

  for (const s of sessions) {
    if (s.role !== 'expert' && s.role !== 'asker') continue
    const role = s.role
    const start = Date.parse(s.joined_at)
    if (Number.isNaN(start)) continue
    let end: number
    if (s.left_at) end = Date.parse(s.left_at)
    else {
      end = Math.max(start, capAt.getTime())
      open[role] = true
    }
    if (Number.isNaN(end) || end < start) continue
    intervals[role].push([start, end])
    count[role]++
  }

  const expert = mergeIntervals(intervals.expert)
  const asker = mergeIntervals(intervals.asker)
  const total = (iv: Interval[]) =>
    Math.round(iv.reduce((sum, [a, b]) => sum + (b - a), 0) / 1000)
  const summarize = (role: 'expert' | 'asker', iv: Interval[]): RoleSummary => ({
    joined: count[role] > 0,
    connected: open[role],
    sessions: count[role],
    reconnects: Math.max(0, count[role] - 1),
    totalSeconds: total(iv),
  })

  return {
    expert: summarize('expert', expert),
    asker: summarize('asker', asker),
    sharedSeconds: overlapSeconds(expert, asker),
  }
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m} min ${s} sec` : `${s} sec`
}
