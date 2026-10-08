import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { isJoinWindowOpen } from '@/lib/follow-up'
import { logFollowUpEvent, meetingLinkHost } from '@/lib/follow-up-events'
import { videoMode } from '@/lib/video/config'
import { getVideoJoinUrl, videoJoinFailure } from '@/lib/video/join'

type JoinRow = {
  id: string
  status: string
  confirmed_start: string | null
  meeting_link: string | null
  expert_joined_at: string | null
  video_provider?: string | null
}

// The expert joins their confirmed conversation. The server decides whether
// the join window is open and records the first join -- the evidence used if
// someone later says the other side never showed up. A conversation held on
// DMQ returns an embedded room; one on the expert's own link returns the link.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-join-expert', subject: user.id, limit: 60, windowSeconds: 3600 },
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

  // The new column is only read when DMQ rooms are switched on.
  const dmqOn = videoMode() === 'dmq'
  const { data } = await supabaseAdmin
    .from('follow_up_calls')
    .select(
      dmqOn
        ? 'id, status, confirmed_start, meeting_link, expert_joined_at, video_provider'
        : 'id, status, confirmed_start, meeting_link, expert_joined_at'
    )
    .eq('id', body.id)
    .eq('expert_id', user.id)
    .maybeSingle()
  const call = data as unknown as JoinRow | null

  if (!call || call.status !== 'confirmed' || !call.confirmed_start) {
    return NextResponse.json({ error: 'This conversation can’t be joined.' }, { status: 404 })
  }

  const recordJoin = () =>
    supabaseAdmin
      .from('follow_up_calls')
      .update({ expert_joined_at: new Date().toISOString() })
      .eq('id', call.id)
      .is('expert_joined_at', null)

  if (dmqOn && call.video_provider === 'dmq') {
    const result = await getVideoJoinUrl({
      followUpId: call.id,
      role: 'expert',
      expertId: user.id,
    })
    if (!result.ok) {
      const failure = videoJoinFailure(result)
      return NextResponse.json({ error: failure.error }, { status: failure.status })
    }
    await recordJoin()
    await logFollowUpEvent(call.id, 'join_link_opened', 'expert', {
      first: !call.expert_joined_at,
      meeting_service: 'dmq',
    })
    return NextResponse.json({ mode: 'embedded', url: result.url, closesAt: result.closesAt })
  }

  if (!call.meeting_link) {
    return NextResponse.json({ error: 'This conversation can’t be joined.' }, { status: 404 })
  }
  if (!isJoinWindowOpen(call.confirmed_start)) {
    return NextResponse.json(
      { error: 'The join link opens 10 minutes before the start.' },
      { status: 403 }
    )
  }

  await recordJoin()
  await logFollowUpEvent(call.id, 'join_link_opened', 'expert', {
    first: !call.expert_joined_at,
    meeting_service: meetingLinkHost(call.meeting_link),
  })

  return NextResponse.json({ mode: 'external', url: call.meeting_link })
}
