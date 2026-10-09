import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'
import { videoLimits, videoMode } from '@/lib/video/config'

// A one-glance check on DMQ-hosted conversations for the admin screen: is it
// switched on and configured, how close are the spending limits, and when did
// the provider last tell us someone connected. Every figure tolerates the new
// tables not existing yet (it just reports "unknown").
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const limits = videoLimits()
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const staleBefore = new Date(Date.now() - 2 * 3600 * 1000).toISOString()

  const [rooms, open, last] = await Promise.all([
    supabaseAdmin
      .from('follow_up_calls')
      .select('id', { count: 'exact', head: true })
      .gte('video_room_created_at', since),
    supabaseAdmin
      .from('follow_up_video_sessions')
      .select('follow_up_id')
      .is('left_at', null)
      .gte('joined_at', staleBefore)
      .limit(500),
    supabaseAdmin
      .from('follow_up_video_sessions')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  return NextResponse.json({
    mode: videoMode(),
    apiKeyConfigured: Boolean(process.env.DAILY_API_KEY),
    webhookSecretConfigured: Boolean(process.env.DAILY_WEBHOOK_HMAC),
    roomsLast24h: rooms.error ? null : (rooms.count ?? 0),
    maxRoomsPerDay: limits.maxRoomsPerDay,
    callsNow: open.error ? null : new Set((open.data ?? []).map((r) => r.follow_up_id)).size,
    maxConcurrent: limits.maxConcurrent,
    lastConnectionRecordedAt: last.error ? null : (last.data?.[0]?.created_at ?? null),
  })
}
