import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'
import { logError } from '@/lib/log-error'
import { APP_BASE_URL } from '@/lib/site'
import { summarizeConnections, type VideoEventRow } from '@/lib/video/connection-summary'
import { videoRoomWindowFor } from '@/lib/follow-up-rules'
import {
  createMeetingToken,
  createRoom,
  joinUrl,
  registerWebhook,
} from '@/lib/video/daily'

// Proof of concept for DMQ-hosted video. Admin only; touches no real booking.

// Recent join/leave events the webhook has received.
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('video_poc_events')
    .select(
      'id, type, room, user_name, user_id, session_id, occurred_at, received_at, joined_at:raw->payload->>joined_at'
    )
    .order('received_at', { ascending: false })
    .limit(60)
  if (error) return NextResponse.json({ events: [], summaries: [], note: error.message })

  // One summary per room, newest room first.
  const byRoom = new Map<string, VideoEventRow[]>()
  for (const e of data ?? []) {
    if (!e.room) continue
    const list = byRoom.get(e.room) ?? []
    list.push(e)
    byRoom.set(e.room, list)
  }
  const summaries = [...byRoom.entries()].slice(0, 5).map(([room, rows]) => ({
    room,
    ...summarizeConnections(rows),
  }))

  return NextResponse.json({ events: (data ?? []).slice(0, 30), summaries })
}

// action "room": a fresh private room plus an expert pass and a guest pass.
// action "webhook": registers our webhook URL with the provider.
export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  let body: {
    action?: unknown
    expertName?: unknown
    callStartsInMinutes?: unknown
    closesAfterStartMinutes?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    if (body.action === 'webhook') {
      const created = await registerWebhook(`${APP_BASE_URL}/api/video/webhook`)
      return NextResponse.json({ ok: true, webhook: created.uuid })
    }

    if (body.action === 'room') {
      const expertName =
        typeof body.expertName === 'string' && body.expertName.trim()
          ? body.expertName.trim().slice(0, 60)
          : 'Priya Sharma'

      // The real timing rules: the room opens 10 minutes before the call
      // starts, the 15 minutes run from the scheduled start, and it closes 5
      // minutes after they end. "Closes after start" can be shortened to try
      // the ejection by hand without waiting 20 minutes.
      const clamp = (value: unknown, min: number, max: number, fallback: number) =>
        typeof value === 'number' && Number.isFinite(value)
          ? Math.min(max, Math.max(min, Math.round(value)))
          : fallback
      const startsIn = clamp(body.callStartsInMinutes, 0, 120, 10)
      const startsAt = new Date(Date.now() + startsIn * 60 * 1000)
      const window = videoRoomWindowFor(startsAt.toISOString())
      const opensAt = window.opensAt
      const closesAfter = clamp(body.closesAfterStartMinutes, 1, 60, 20)
      const closesAt =
        body.closesAfterStartMinutes === undefined
          ? window.closesAt
          : new Date(startsAt.getTime() + closesAfter * 60 * 1000)
      const room = await createRoom({ opensAt, closesAt })

      const [expertToken, guestToken] = await Promise.all([
        createMeetingToken({
          roomName: room.name,
          userName: expertName,
          userId: 'expert-poc',
          isOwner: true,
          opensAt,
          closesAt,
        }),
        createMeetingToken({
          roomName: room.name,
          userName: 'Guest',
          userId: 'asker-poc',
          isOwner: false,
          opensAt,
          closesAt,
        }),
      ])

      return NextResponse.json({
        room: room.name,
        startsAt: startsAt.toISOString(),
        scheduledEnd: window.scheduledEnd.toISOString(),
        opensAt: opensAt.toISOString(),
        closesAt: closesAt.toISOString(),
        expertUrl: joinUrl(room.url, expertToken),
        guestUrl: joinUrl(room.url, guestToken),
      })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    await logError('video-poc', err, { action: String(body.action), adminEmail: admin.email })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
