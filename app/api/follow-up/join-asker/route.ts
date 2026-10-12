import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logFollowUpEvent } from '@/lib/follow-up-events'
import { getVideoJoinUrl, videoJoinFailure } from '@/lib/video/join'

type JoinRow = {
  id: string
  status: string
  confirmed_start: string | null
  asker_joined_at: string | null
}

// The asker joins from their private join page. They have no account, so the
// unguessable booking id in their emailed link is what identifies them -- the
// same trust as the feedback and booking links. The first join is recorded.
// Every conversation is held on DMQ, so this returns an embedded room, with a
// pass made for this click.
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

  const { data } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, status, confirmed_start, asker_joined_at')
    .eq('id', body.id)
    .maybeSingle()
  const call = data as unknown as JoinRow | null

  if (!call || call.status !== 'confirmed' || !call.confirmed_start) {
    return NextResponse.json({ error: 'This conversation can’t be joined.' }, { status: 404 })
  }

  const recordJoin = () =>
    supabaseAdmin
      .from('follow_up_calls')
      .update({ asker_joined_at: new Date().toISOString() })
      .eq('id', call.id)
      .is('asker_joined_at', null)

  const result = await getVideoJoinUrl({ followUpId: call.id, role: 'asker' })
  if (!result.ok) {
    const failure = videoJoinFailure(result)
    return NextResponse.json({ error: failure.error }, { status: failure.status })
  }
  await recordJoin()
  await logFollowUpEvent(call.id, 'join_link_opened', 'asker', {
    first: !call.asker_joined_at,
    meeting_service: 'dmq',
  })
  return NextResponse.json({ mode: 'embedded', url: result.url, closesAt: result.closesAt })
}
