import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'
import { verifyDailyWebhook } from '@/lib/video/daily'

// Proof of concept: stores the video provider's join/leave events. Public, but
// every request must carry a valid signature, so anything unsigned is refused.
export async function POST(request: Request) {
  const rawBody = await request.text()

  const valid = verifyDailyWebhook(rawBody, {
    signature: request.headers.get('x-webhook-signature'),
    timestamp: request.headers.get('x-webhook-timestamp'),
  })
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: {
    id?: string
    type?: string
    event_ts?: number
    payload?: Record<string, unknown>
    test?: string
  }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Daily checks a new webhook URL with a signed {"test":"test"}.
  if (event.test === 'test') return NextResponse.json({ ok: true })
  if (!event.id || !event.type) return NextResponse.json({ ok: true })

  const p = event.payload ?? {}
  const joinedAt = typeof p.joined_at === 'number' ? p.joined_at : event.event_ts
  const { error } = await supabaseAdmin.from('video_poc_events').upsert(
    {
      id: event.id,
      type: event.type,
      room: typeof p.room === 'string' ? p.room : null,
      user_name: typeof p.user_name === 'string' ? p.user_name : null,
      user_id: typeof p.user_id === 'string' ? p.user_id : null,
      session_id: typeof p.session_id === 'string' ? p.session_id : null,
      occurred_at: joinedAt ? new Date(joinedAt * 1000).toISOString() : null,
      raw: event,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  )
  if (error) {
    await logError('video-poc:webhook', error, { eventType: event.type })
    // A 5xx makes Daily retry.
    return NextResponse.json({ error: 'Could not store event' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
