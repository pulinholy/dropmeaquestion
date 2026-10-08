import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enforceRateLimit } from '@/lib/rate-limit'
import { isJoinWindowOpen } from '@/lib/follow-up'
import { logFollowUpEvent, meetingLinkHost } from '@/lib/follow-up-events'

// The asker joins from their private join page. They have no account, so the
// unguessable booking id in their emailed link is what identifies them -- the
// same trust as the feedback and booking links. The meeting link only comes
// back while the join window is open, and the first join is recorded.
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-join-asker', limit: 30, windowSeconds: 3600 },
  ])
  if (limited) return limited

  let body: { id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { data: call } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, status, confirmed_start, meeting_link, asker_joined_at')
    .eq('id', body.id)
    .maybeSingle()

  if (!call || call.status !== 'confirmed' || !call.confirmed_start || !call.meeting_link) {
    return NextResponse.json({ error: 'This conversation can’t be joined.' }, { status: 404 })
  }
  if (!isJoinWindowOpen(call.confirmed_start)) {
    return NextResponse.json(
      { error: 'The join link opens 10 minutes before the start.' },
      { status: 403 }
    )
  }

  await supabaseAdmin
    .from('follow_up_calls')
    .update({ asker_joined_at: new Date().toISOString() })
    .eq('id', call.id)
    .is('asker_joined_at', null)
  await logFollowUpEvent(call.id, 'join_link_opened', 'asker', {
    first: !call.asker_joined_at,
    meeting_service: meetingLinkHost(call.meeting_link),
  })

  return NextResponse.json({ url: call.meeting_link })
}
