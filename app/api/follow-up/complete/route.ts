import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { FOLLOW_UP_NO_SHOW_AFTER_MINUTES } from '@/lib/follow-up'
import { settleFollowUp } from '@/lib/follow-up-settle'

// After the start time the expert settles their own conversation: it took
// place (the asker is charged, the expert paid), or the asker never joined
// (charged in full under the policy). "Never joined" is only accepted if the
// server never saw the asker open the join page and the slot has fully
// elapsed -- the expert's word alone isn't enough.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-expert-action', subject: user.id, limit: 60, windowSeconds: 3600 },
  ])
  if (limited) return limited

  let body: { id?: unknown; outcome?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (
    typeof body.id !== 'string' ||
    (body.outcome !== 'completed' && body.outcome !== 'asker_no_show')
  ) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { data: call } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, status, confirmed_start, asker_joined_at')
    .eq('id', body.id)
    .eq('expert_id', user.id)
    .maybeSingle()

  if (!call || call.status !== 'confirmed' || !call.confirmed_start) {
    return NextResponse.json(
      { error: 'This conversation can’t be updated.' },
      { status: 409 }
    )
  }

  const start = new Date(call.confirmed_start).getTime()
  if (Date.now() < start) {
    return NextResponse.json(
      { error: 'This conversation hasn’t started yet.' },
      { status: 409 }
    )
  }

  if (body.outcome === 'asker_no_show') {
    if (call.asker_joined_at) {
      return NextResponse.json(
        {
          error:
            'The asker opened the join page, so this can’t be marked as a no-show. Mark it completed, or report a problem.',
        },
        { status: 409 }
      )
    }
    if (Date.now() < start + FOLLOW_UP_NO_SHOW_AFTER_MINUTES * 60 * 1000) {
      return NextResponse.json(
        {
          error: `Please wait until the ${FOLLOW_UP_NO_SHOW_AFTER_MINUTES}-minute slot has ended before reporting that the asker didn’t join.`,
        },
        { status: 409 }
      )
    }
  }

  const result = await settleFollowUp({
    id: call.id,
    from: ['confirmed'],
    outcome: body.outcome,
    reason: `expert_marked_${body.outcome}`,
    expertId: user.id,
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: 'This conversation has already been updated. Please refresh.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true })
}
