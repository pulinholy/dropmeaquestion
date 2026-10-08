import { supabaseAdmin } from '../supabase-admin'
import { logError } from '../log-error'
import { send } from '../send-follow-up-emails'
import { videoRoomWindowFor } from '../follow-up-rules'
import { createRoom, deleteRoom } from './daily'
import { videoLimits } from './config'
import { limitVerdict, type LimitVerdict } from './limits'

export type VideoRoomResult =
  | { ok: true; name: string; url: string }
  | { ok: false; reason: 'not_found' | 'not_dmq' | 'limit' | 'unavailable' }

const SUPPORT_EMAIL = 'hello@dropmeaquestion.com'

// One alert per instance per hour is plenty; the point is that a limit being
// hit is never silent.
let lastLimitAlertAt = 0

async function alertLimit(verdict: Exclude<LimitVerdict, 'ok'>, followUpId: string) {
  if (Date.now() - lastLimitAlertAt < 3600 * 1000) return
  lastLimitAlertAt = Date.now()
  const what =
    verdict === 'rooms_per_day'
      ? 'the daily limit on new video rooms (VIDEO_MAX_ROOMS_PER_DAY)'
      : 'the limit on calls running at once (VIDEO_MAX_CONCURRENT)'
  await send(
    SUPPORT_EMAIL,
    'Video room limit reached',
    `<p style="margin:0 0 12px;">Someone tried to start a conversation but DMQ hit ${what}, so no room was created.</p><p style="margin:0;">Booking: ${followUpId}. If this is real demand, raise the limit in Vercel; if it looks wrong, check Daily's usage.</p>`,
    'video-room:limit-alert'
  )
}

// The spending guard: counts rooms made in the last 24 hours and calls that
// are running right now, from our own records.
async function checkLimits(): Promise<LimitVerdict> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count, error } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id', { count: 'exact', head: true })
    .gte('video_room_created_at', since)
  if (error) throw error

  // A session with no leave event is only counted for a couple of hours, so a
  // lost event can't hold a call slot forever.
  const staleBefore = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  const { data: open, error: openError } = await supabaseAdmin
    .from('follow_up_video_sessions')
    .select('follow_up_id')
    .is('left_at', null)
    .gte('joined_at', staleBefore)
    .limit(500)
  if (openError) throw openError

  return limitVerdict(
    {
      roomsLast24h: count ?? 0,
      concurrentCalls: new Set((open ?? []).map((r) => r.follow_up_id)).size,
    },
    videoLimits()
  )
}

// Finds the booking's room, or makes it the first time someone asks to join.
// Rooms are created here, never at confirmation, so a cancelled booking
// leaves nothing behind. Safe if both people ask at the same moment: the room
// name is claimed on the booking, and a loser's extra room is removed.
export async function getOrCreateVideoRoom(followUpId: string): Promise<VideoRoomResult> {
  try {
    const { data: call } = await supabaseAdmin
      .from('follow_up_calls')
      .select('id, status, video_provider, confirmed_start, video_room_name, video_room_url')
      .eq('id', followUpId)
      .maybeSingle()
    if (!call || call.status !== 'confirmed' || !call.confirmed_start) {
      return { ok: false, reason: 'not_found' }
    }
    if (call.video_provider !== 'dmq') return { ok: false, reason: 'not_dmq' }
    if (call.video_room_name && call.video_room_url) {
      return { ok: true, name: call.video_room_name, url: call.video_room_url }
    }

    const verdict = await checkLimits()
    if (verdict !== 'ok') {
      await alertLimit(verdict, followUpId)
      return { ok: false, reason: 'limit' }
    }

    const { opensAt, closesAt } = videoRoomWindowFor(call.confirmed_start)
    const room = await createRoom({ opensAt, closesAt })

    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('follow_up_calls')
      .update({
        video_room_name: room.name,
        video_room_url: room.url,
        video_room_created_at: new Date().toISOString(),
      })
      .eq('id', followUpId)
      .is('video_room_name', null)
      .select('id')
    if (claimError) throw claimError

    if (claimed && claimed.length > 0) return { ok: true, name: room.name, url: room.url }

    // Someone else claimed it first: use theirs and remove ours.
    await deleteRoom(room.name).catch(() => {})
    const { data: winner } = await supabaseAdmin
      .from('follow_up_calls')
      .select('video_room_name, video_room_url')
      .eq('id', followUpId)
      .maybeSingle()
    if (winner?.video_room_name && winner.video_room_url) {
      return { ok: true, name: winner.video_room_name, url: winner.video_room_url }
    }
    return { ok: false, reason: 'unavailable' }
  } catch (err) {
    await logError('video-room', err, { followUpId })
    return { ok: false, reason: 'unavailable' }
  }
}
