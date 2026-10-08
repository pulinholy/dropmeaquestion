import { supabaseAdmin } from './supabase-admin'
import { logError } from './log-error'

export type FollowUpActor = 'asker' | 'expert' | 'system' | 'admin'

let loggedFailure = false

// Appends to a booking's evidence timeline. It never throws and never blocks
// the action it records: if the table isn't there yet, or the write fails,
// the booking carries on and the first failure is logged.
export async function logFollowUpEvent(
  followUpId: string,
  event: string,
  actor: FollowUpActor,
  detail?: Record<string, unknown>
) {
  try {
    const { error } = await supabaseAdmin
      .from('follow_up_events')
      .insert({ follow_up_id: followUpId, event, actor, detail: detail ?? null })
    if (error) throw error
  } catch (err) {
    if (!loggedFailure) {
      loggedFailure = true
      await logError('follow-up-events', err, { followUpId, event })
    }
  }
}

// Only the host of a meeting link goes in the timeline: enough to show where
// the conversation was meant to happen without copying a passcode.
export function meetingLinkHost(link: string | null | undefined): string | null {
  if (!link) return null
  try {
    return new URL(link).hostname
  } catch {
    return null
  }
}
