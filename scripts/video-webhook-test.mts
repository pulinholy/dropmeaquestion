// Sends signed, made-up join and leave events to the local video webhook, to
// check it records sessions without needing a real call.
//
//   node --env-file=.env.local scripts/video-webhook-test.mts <booking id> <room name>
//
// First make the booking look like a DMQ-hosted one (dev only):
//   update follow_up_calls
//      set video_provider = 'dmq', video_room_name = '<room name>'
//    where id = '<booking id>';
//
// Then look at the result:
//   select role, session_id, joined_at, left_at
//     from follow_up_video_sessions where follow_up_id = '<booking id>';

import { createHmac, randomUUID } from 'node:crypto'

const [bookingId, room] = process.argv.slice(2)
const secret = process.env.DAILY_WEBHOOK_HMAC
const base = process.env.WEBHOOK_TEST_URL ?? 'http://localhost:3000'

if (!bookingId || !room || !secret) {
  console.error('Usage: node --env-file=.env.local scripts/video-webhook-test.mts <booking id> <room name>')
  console.error('DAILY_WEBHOOK_HMAC must be set in .env.local.')
  process.exit(1)
}

async function send(label: string, body: object) {
  const raw = JSON.stringify(body)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac('sha256', Buffer.from(secret!, 'base64'))
    .update(`${timestamp}.${raw}`)
    .digest('base64')
  const res = await fetch(`${base}/api/video/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-signature': signature,
      'x-webhook-timestamp': timestamp,
    },
    body: raw,
  })
  console.log(`${res.status}  ${label}`)
}

const now = Math.floor(Date.now() / 1000)
const event = (type: string, ts: number, payload: Record<string, unknown>) => ({
  version: '1.0.0',
  type,
  id: `test-${randomUUID()}`,
  event_ts: ts,
  payload,
})

const expertSession = `test-expert-${randomUUID()}`
const askerSession = `test-asker-${randomUUID()}`
const expertJoin = event('participant.joined', now, {
  room,
  user_id: `expert-${bookingId}`,
  user_name: 'Test Expert',
  session_id: expertSession,
  joined_at: now,
})

await send('expert joins', expertJoin)
await send('asker joins', event('participant.joined', now + 60, {
  room, user_id: `asker-${bookingId}`, user_name: 'Guest', session_id: askerSession, joined_at: now + 60,
}))
// The same join delivered again must change nothing.
await send('expert joins (repeat of the same event)', expertJoin)
await send('asker leaves', event('participant.left', now + 600, {
  room, user_id: `asker-${bookingId}`, session_id: askerSession, joined_at: now + 60,
}))
await send('expert leaves', event('participant.left', now + 660, {
  room, user_id: `expert-${bookingId}`, session_id: expertSession, joined_at: now,
}))
// Wrong room for this booking, and a stranger's id: both must be ignored.
await send('wrong room (ignored)', event('participant.joined', now, {
  room: 'dmq-some-other-room', user_id: `asker-${bookingId}`, session_id: 'x1', joined_at: now,
}))
await send('unknown user (ignored)', event('participant.joined', now, {
  room, user_id: 'someone@example.com', session_id: 'x2', joined_at: now,
}))
console.log('Done. Expect 2 sessions for the booking, both with a left_at.')
