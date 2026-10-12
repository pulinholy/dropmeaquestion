import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logFollowUpEvent } from '@/lib/follow-up-events'
import { getVideoJoinUrl, videoJoinFailure } from '@/lib/video/join'

type JoinRow = {
  id: string
  status: string
  confirmed_start: string | null
  expert_joined_at: string | null
}

// The expert joins their confirmed conversation. The server decides whether
// the join window is open and records the first join -- the evidence used if
// someone later says the other side never showed up. Every conversation is
// held on DMQ, so this returns an embedded room.
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

  const { data } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, status, confirmed_start, expert_joined_at')
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
