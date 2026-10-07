import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { isJoinWindowOpen } from '@/lib/follow-up'

// The expert joins their confirmed conversation. The server decides whether
// the join window is open and records the first join -- the evidence used if
// someone later says the other side never showed up.
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

  const { data: call } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, status, confirmed_start, meeting_link')
    .eq('id', body.id)
    .eq('expert_id', user.id)
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
    .update({ expert_joined_at: new Date().toISOString() })
    .eq('id', call.id)
    .is('expert_joined_at', null)

  return NextResponse.json({ url: call.meeting_link })
}
