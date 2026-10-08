import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'
import { logFollowUpEvent } from '@/lib/follow-up-events'
import { verifyDailyWebhook } from '@/lib/video/daily'
import { parseDailyEvent } from '@/lib/video/events'

// The video provider's join and leave events. Public, but every request must
// carry a valid signature, so anything unsigned is refused. Times come from
// the provider's servers, never from a browser, which is what makes them fit
// to settle a payment from. Safe to receive twice: retries and duplicates
// change nothing.
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

  // The provider checks a new webhook address with a signed {"test":"test"}.
  if (event.test === 'test') return NextResponse.json({ ok: true })
  if (!event.id || !event.type) return NextResponse.json({ ok: true })

  // The admin proof-of-concept page keeps its own copy of the raw events. It
  // is optional, so a missing table or a failed write is ignored.
  const p = event.payload ?? {}
  const happenedAt =
    event.type === 'participant.joined' && typeof p.joined_at === 'number'
      ? p.joined_at
      : event.event_ts
  await supabaseAdmin
    .from('video_poc_events')
    .upsert(
      {
        id: event.id,
        type: event.type,
        room: typeof p.room === 'string' ? p.room : null,
        user_name: typeof p.user_name === 'string' ? p.user_name : null,
        user_id: typeof p.user_id === 'string' ? p.user_id : null,
        session_id: typeof p.session_id === 'string' ? p.session_id : null,
        occurred_at: happenedAt ? new Date(happenedAt * 1000).toISOString() : null,
        raw: event,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )
    .then(
      () => undefined,
      () => undefined
    )

  const parsed = parseDailyEvent(event)
  if (parsed.kind === 'other') return NextResponse.json({ ok: true })

  try {
    // Only events for a real booking's own room count, and the pass's id must
    // name that same booking.
    const { data: booking } = await supabaseAdmin
      .from('follow_up_calls')
      .select('id, video_room_name')
      .eq('id', parsed.followUpId)
      .maybeSingle()
    if (!booking || booking.video_room_name !== parsed.room) {
      return NextResponse.json({ ok: true })
    }

    if (parsed.kind === 'joined') {
      if (!parsed.joinedAt) return NextResponse.json({ ok: true })
      const { data: inserted, error } = await supabaseAdmin
        .from('follow_up_video_sessions')
        .upsert(
          {
            follow_up_id: booking.id,
            role: parsed.role,
            session_id: parsed.sessionId,
            joined_at: parsed.joinedAt,
          },
          { onConflict: 'session_id', ignoreDuplicates: true }
        )
        .select('id')
      if (error) throw error
      if (inserted && inserted.length > 0) {
        await logFollowUpEvent(booking.id, 'video_joined', parsed.role, {
          at: parsed.joinedAt,
        })
      }
      return NextResponse.json({ ok: true })
    }

    // left
    const { data: closed, error: closeError } = await supabaseAdmin
      .from('follow_up_video_sessions')
      .update({ left_at: parsed.leftAt })
      .eq('session_id', parsed.sessionId)
      .is('left_at', null)
      .select('id')
    if (closeError) throw closeError

    let recorded = Boolean(closed && closed.length > 0)
    if (!recorded) {
      // No open session to close. If we never saw it join (that event was
      // lost or late), rebuild it from the join time the provider sent.
      const { data: existing } = await supabaseAdmin
        .from('follow_up_video_sessions')
        .select('id')
        .eq('session_id', parsed.sessionId)
        .maybeSingle()
      if (!existing && parsed.joinedAt) {
        const { error: insertError } = await supabaseAdmin
          .from('follow_up_video_sessions')
          .insert({
            follow_up_id: booking.id,
            role: parsed.role,
            session_id: parsed.sessionId,
            joined_at: parsed.joinedAt,
            left_at: parsed.leftAt,
          })
        if (insertError && (insertError as { code?: string }).code !== '23505') throw insertError
        recorded = !insertError
      }
    }
    if (recorded) {
      await logFollowUpEvent(booking.id, 'video_left', parsed.role, { at: parsed.leftAt })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    await logError('video-webhook', err, { eventType: event.type })
    // A 5xx makes the provider retry.
    return NextResponse.json({ error: 'Could not store event' }, { status: 500 })
  }
}
