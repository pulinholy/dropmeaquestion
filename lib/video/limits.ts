// The spending guard for DMQ-hosted rooms: a cap on how many rooms can be
// made in a day and how many calls can be running at once. Pure, so the rule
// can be tested without a database.

export type VideoLimits = { maxRoomsPerDay: number; maxConcurrent: number }

export type LimitVerdict = 'ok' | 'rooms_per_day' | 'concurrent'

export function limitVerdict(
  counts: { roomsLast24h: number; concurrentCalls: number },
  limits: VideoLimits
): LimitVerdict {
  if (counts.roomsLast24h >= limits.maxRoomsPerDay) return 'rooms_per_day'
  if (counts.concurrentCalls >= limits.maxConcurrent) return 'concurrent'
  return 'ok'
}

function intFromEnv(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// Generous defaults; raise them in Vercel when real volume needs it.
export function videoLimitsFromEnv(env: Record<string, string | undefined>): VideoLimits {
  return {
    maxRoomsPerDay: intFromEnv(env.VIDEO_MAX_ROOMS_PER_DAY, 100),
    maxConcurrent: intFromEnv(env.VIDEO_MAX_CONCURRENT, 10),
  }
}
