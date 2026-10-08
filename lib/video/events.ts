// Reads the provider's webhook events into the shape we store. Pure, so it is
// tested without a database or network.

export type ParsedVideoEvent =
  | {
      kind: 'joined' | 'left'
      room: string
      sessionId: string
      role: 'expert' | 'asker'
      followUpId: string
      // When this session connected. On a "left" event it comes from the
      // provider's own record of that session.
      joinedAt: string | null
      // Only on a "left" event: when the provider says they left.
      leftAt: string | null
    }
  | { kind: 'other' }

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const USER_ID = new RegExp(`^(expert|asker)-(${UUID})$`, 'i')

// Our passes carry "expert-<booking id>" or "asker-<booking id>" and nothing
// else, so an event can't be tied to the wrong booking by its room alone.
export function parseVideoUserId(
  userId: unknown
): { role: 'expert' | 'asker'; followUpId: string } | null {
  if (typeof userId !== 'string') return null
  const m = USER_ID.exec(userId)
  if (!m) return null
  return { role: m[1].toLowerCase() as 'expert' | 'asker', followUpId: m[2].toLowerCase() }
}

function toIso(seconds: unknown): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null
  return new Date(seconds * 1000).toISOString()
}

export function parseDailyEvent(event: {
  type?: unknown
  event_ts?: unknown
  payload?: Record<string, unknown>
}): ParsedVideoEvent {
  const type = event.type
  if (type !== 'participant.joined' && type !== 'participant.left') return { kind: 'other' }

  const p = event.payload ?? {}
  const user = parseVideoUserId(p.user_id)
  if (!user || typeof p.room !== 'string' || typeof p.session_id !== 'string') {
    return { kind: 'other' }
  }

  const joinedAt = toIso(p.joined_at) ?? (type === 'participant.joined' ? toIso(event.event_ts) : null)
  return {
    kind: type === 'participant.joined' ? 'joined' : 'left',
    room: p.room,
    sessionId: p.session_id,
    role: user.role,
    followUpId: user.followUpId,
    joinedAt,
    leftAt: type === 'participant.left' ? toIso(event.event_ts) : null,
  }
}
