import { supabaseAdmin } from '../supabase-admin'
import { videoRoomWindowFor, videoSettlementFor, type VideoSettlement } from '../follow-up-rules'
import { summarizeSessions, type ConnectionSummary } from './connection-summary'

// Reads a booking's stored connections and decides how it ends. Used by the
// daily job once the asker has had their chance to confirm or report.
export async function loadConnectionSummary(
  followUpId: string,
  confirmedStart: string
): Promise<ConnectionSummary & { anySessions: boolean }> {
  const { data, error } = await supabaseAdmin
    .from('follow_up_video_sessions')
    .select('role, joined_at, left_at')
    .eq('follow_up_id', followUpId)
  if (error) throw error

  // A connection with no recorded leave is counted until the room closed.
  const { closesAt } = videoRoomWindowFor(confirmedStart)
  const sessions = data ?? []
  return { ...summarizeSessions(sessions, closesAt), anySessions: sessions.length > 0 }
}

export async function decideVideoSettlement(row: {
  id: string
  confirmed_start: string
  asker_joined_at: string | null
  expert_joined_at: string | null
  expert_marked: string | null
}): Promise<{ decision: VideoSettlement; summary: ConnectionSummary }> {
  const summary = await loadConnectionSummary(row.id, row.confirmed_start)
  const decision = videoSettlementFor({
    expertConnected: summary.expert.joined,
    askerConnected: summary.asker.joined,
    sharedSeconds: summary.sharedSeconds,
    anySessions: summary.anySessions,
    askerClicked: Boolean(row.asker_joined_at),
    expertClicked: Boolean(row.expert_joined_at),
    expertMarked:
      row.expert_marked === 'completed' || row.expert_marked === 'asker_no_show'
        ? row.expert_marked
        : null,
  })
  return { decision, summary }
}
