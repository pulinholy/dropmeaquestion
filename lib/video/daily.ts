import { createHmac, randomUUID, timingSafeEqual } from 'crypto'

// Proof of concept: DMQ-hosted video rooms on Daily (https://docs.daily.co).
// Not used by any live follow-up conversation. See docs/video-provider-comparison.md.

const API = 'https://api.daily.co/v1'

function apiKey(): string {
  const key = process.env.DAILY_API_KEY
  if (!key) throw new Error('DAILY_API_KEY is not set')
  return key
}

async function daily<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Daily ${res.status}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : {}) as T
}

const seconds = (d: Date) => Math.floor(d.getTime() / 1000)

// One private room per conversation. Private means nobody can enter without a
// meeting token, and the random name keeps it unguessable anyway. The room
// only exists between nbf and exp, holds two people, and has no recording
// switched on (recording is off unless a room or token enables it).
export async function createRoom({ opensAt, closesAt }: { opensAt: Date; closesAt: Date }) {
  return daily<{ name: string; url: string }>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: `dmq-${randomUUID()}`,
      privacy: 'private',
      properties: {
        nbf: seconds(opensAt),
        exp: seconds(closesAt),
        max_participants: 2,
        eject_at_room_exp: true,
      },
    }),
  })
}

// A personal, time-limited pass into one room. The display name and the
// opaque user_id come from here, not from the person: nobody's email or phone
// is ever sent to Daily. The token only works inside the window.
//
// Conversations are audio first: everyone joins with the camera off and can
// switch it on. (A token setting beats the room's, so it's set here. Note
// that Daily's cheaper audio-only rate needs a session that never sends any
// video, which this deliberately doesn't enforce.)
export async function createMeetingToken({
  roomName,
  userName,
  userId,
  isOwner,
  opensAt,
  closesAt,
}: {
  roomName: string
  userName: string
  userId: string
  isOwner: boolean
  opensAt: Date
  closesAt: Date
}): Promise<string> {
  const { token } = await daily<{ token: string }>('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        user_id: userId,
        is_owner: isOwner,
        nbf: seconds(opensAt),
        exp: seconds(closesAt),
        eject_at_token_exp: true,
        start_video_off: true,
      },
    }),
  })
  return token
}

export async function deleteRoom(roomName: string) {
  await daily(`/rooms/${encodeURIComponent(roomName)}`, { method: 'DELETE' })
}

// The page a participant opens (or that we put in an iframe).
export function joinUrl(roomUrl: string, token: string): string {
  return `${roomUrl}?t=${encodeURIComponent(token)}`
}

// Join/leave events for troubleshooting and evidence. Daily requires a card on
// file to use webhooks, and checks the URL answers with a signed test request.
export async function registerWebhook(url: string) {
  const hmac = process.env.DAILY_WEBHOOK_HMAC
  if (!hmac) throw new Error('DAILY_WEBHOOK_HMAC is not set')
  return daily<{ uuid: string }>('/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      url,
      hmac,
      retryType: 'exponential',
      eventTypes: ['meeting.started', 'meeting.ended', 'participant.joined', 'participant.left'],
    }),
  })
}

// Daily signs `<timestamp>.<raw body>` with HMAC-SHA256, keyed by the base64-
// decoded secret, and sends the base64 result in X-Webhook-Signature.
export function verifyDailyWebhook(
  rawBody: string,
  headers: { signature: string | null; timestamp: string | null },
  now: Date = new Date()
): boolean {
  const secret = process.env.DAILY_WEBHOOK_HMAC
  if (!secret || !headers.signature || !headers.timestamp) return false

  // Refuse stale deliveries so a captured request can't be replayed later.
  const sentMs = Number(headers.timestamp) * (headers.timestamp.length <= 10 ? 1000 : 1)
  if (!Number.isFinite(sentMs) || Math.abs(now.getTime() - sentMs) > 5 * 60 * 1000) return false

  const expected = createHmac('sha256', Buffer.from(secret, 'base64'))
    .update(`${headers.timestamp}.${rawBody}`)
    .digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(headers.signature)
  return a.length === b.length && timingSafeEqual(a, b)
}
