import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'
import { logError } from '@/lib/log-error'
import { APP_BASE_URL } from '@/lib/site'
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
    .select('id, type, room, user_name, user_id, occurred_at, received_at')
    .order('received_at', { ascending: false })
    .limit(30)
  if (error) return NextResponse.json({ events: [], note: error.message })
  return NextResponse.json({ events: data })
}

// action "room": a fresh private room plus an expert pass and a guest pass.
// action "webhook": registers our webhook URL with the provider.
export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  let body: { action?: unknown; expertName?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    if (body.action === 'webhook') {
      const created = await registerWebhook(`${APP_BASE_URL}/api/video/daily-webhook`)
      return NextResponse.json({ ok: true, webhook: created.uuid })
    }

    if (body.action === 'room') {
      const expertName =
        typeof body.expertName === 'string' && body.expertName.trim()
          ? body.expertName.trim().slice(0, 60)
          : 'Priya Sharma'

      // A 30-minute window stands in for the real "10 minutes before to 30
      // minutes after" join window.
      const opensAt = new Date()
      const closesAt = new Date(opensAt.getTime() + 30 * 60 * 1000)
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
