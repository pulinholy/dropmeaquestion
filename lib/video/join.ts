import { supabaseAdmin } from '../supabase-admin'
import { logError } from '../log-error'
import { videoRoomWindowFor } from '../follow-up-rules'
import { logFollowUpEvent } from '../follow-up-events'
import { createMeetingToken, joinUrl } from './daily'
import { getOrCreateVideoRoom } from './room'

export type VideoJoinResult =
  | { ok: true; url: string; closesAt: string }
  | {
      ok: false
      reason:
        | 'not_found'
        | 'not_dmq'
        | 'too_early'
        | 'closed'
        | 'limit'
        | 'unavailable'
      opensAt?: string
    }

export function videoJoinFailure(result: Extract<VideoJoinResult, { ok: false }>): {
  status: number
  error: string
} {
  switch (result.reason) {
    case 'too_early':
      return { status: 403, error: 'The conversation opens 10 minutes before the start.' }
    case 'closed':
      return { status: 403, error: 'This conversation has ended.' }
    case 'limit':
      return {
        status: 503,
        error: 'We can’t start the call right now. Please try again in a few minutes.',
      }
    case 'unavailable':
      return {
        status: 502,
        error: 'We couldn’t open the conversation. Please try again in a moment.',
      }
    default:
      return { status: 404, error: 'This conversation can’t be joined.' }
  }
}

// The one place a person gets into a DMQ-hosted conversation. Called when
// they click Join (slice 2 wires the endpoints). Checks the booking and the
// time window, finds or makes the room, and makes a pass for this one person:
// the expert under their profile name, the asker as "Guest", an opaque id
// made from the role and booking, camera off, no screen sharing, removed at
// the room's close. The pass is returned to that person's browser only; it is
// never emailed, stored or logged.
export async function getVideoJoinUrl({
  followUpId,
  role,
  expertId,
}: {
  followUpId: string
  role: 'expert' | 'asker'
  // Required for the expert: the booking must belong to them.
  expertId?: string
}): Promise<VideoJoinResult> {
  try {
    const { data: call } = await supabaseAdmin
      .from('follow_up_calls')
      .select('id, expert_id, status, video_provider, confirmed_start')
      .eq('id', followUpId)
      .maybeSingle()

    if (!call || call.status !== 'confirmed' || !call.confirmed_start) {
      return { ok: false, reason: 'not_found' }
    }
    if (role === 'expert' && call.expert_id !== expertId) {
      return { ok: false, reason: 'not_found' }
    }
    if (call.video_provider !== 'dmq') return { ok: false, reason: 'not_dmq' }

    const window = videoRoomWindowFor(call.confirmed_start)
    const now = Date.now()
    if (now < window.opensAt.getTime()) {
      return { ok: false, reason: 'too_early', opensAt: window.opensAt.toISOString() }
    }
    if (now > window.closesAt.getTime()) return { ok: false, reason: 'closed' }

    const room = await getOrCreateVideoRoom(followUpId)
    if (!room.ok) {
      return { ok: false, reason: room.reason === 'not_found' ? 'not_found' : room.reason }
    }

    let displayName = 'Guest'
    if (role === 'expert') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', call.expert_id)
        .maybeSingle()
      displayName = profile?.full_name?.trim() || 'Expert'
    }

    const token = await createMeetingToken({
      roomName: room.name,
      userName: displayName,
      userId: `${role}-${followUpId}`,
      isOwner: role === 'expert',
      opensAt: window.opensAt,
      closesAt: window.closesAt,
    })

    await logFollowUpEvent(followUpId, 'video_pass_issued', role)
    return { ok: true, url: joinUrl(room.url, token), closesAt: window.closesAt.toISOString() }
  } catch (err) {
    await logError('video-join', err, { followUpId, role })
    return { ok: false, reason: 'unavailable' }
  }
}
