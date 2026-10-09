import { supabaseAdmin } from '../supabase-admin'
import { logError } from '../log-error'
import { logFollowUpEvent } from '../follow-up-events'
import { listRoomMeetings } from './daily'
import { parseVideoUserId } from './events'

// The safety net behind the webhook. If join and leave events never reached
// us (the webhook was down, misconfigured or unreachable), the provider still
// has its own record of who was in the room. Before a booking is settled,
// this copies that record in so a missed webhook doesn't decide the outcome.
//
// Best effort: it never throws and never invents anything. Only people whose
// pass names this booking are used, and existing records are only completed
// (a missing leave time), never overwritten. Times are the provider's, with
// about 15 seconds of precision, and a join under 10 seconds isn't recorded.
export async function backfillSessionsFromProvider(
  followUpId: string,
  roomName: string
): Promise<number> {
  try {
    const meetings = await listRoomMeetings(roomName)
    let changed = 0

    for (const meeting of meetings) {
      for (const p of meeting.participants) {
        const user = parseVideoUserId(p.user_id)
        if (!user || user.followUpId !== followUpId) continue
        if (typeof p.join_time !== 'number') continue

        const joinedAt = new Date(p.join_time * 1000).toISOString()
        const leftAt =
          typeof p.duration === 'number' && !meeting.ongoing
            ? new Date((p.join_time + p.duration) * 1000).toISOString()
            : null

        const { data: existing, error } = await supabaseAdmin
          .from('follow_up_video_sessions')
          .select('id, left_at')
          .eq('session_id', p.participant_id)
          .maybeSingle()
        if (error) throw error

        if (!existing) {
          const { error: insertError } = await supabaseAdmin
            .from('follow_up_video_sessions')
            .insert({
              follow_up_id: followUpId,
              role: user.role,
              session_id: p.participant_id,
              joined_at: joinedAt,
              left_at: leftAt,
            })
          if (insertError && (insertError as { code?: string }).code !== '23505') throw insertError
          if (!insertError) changed++
        } else if (!existing.left_at && leftAt) {
          const { error: updateError } = await supabaseAdmin
            .from('follow_up_video_sessions')
            .update({ left_at: leftAt })
            .eq('id', existing.id)
            .is('left_at', null)
          if (updateError) throw updateError
          changed++
        }
      }
    }

    if (changed > 0) {
      await logFollowUpEvent(followUpId, 'video_sessions_backfilled', 'system', { changed })
    }
    return changed
  } catch (err) {
    await logError('video-backfill', err, { followUpId })
    return 0
  }
}
