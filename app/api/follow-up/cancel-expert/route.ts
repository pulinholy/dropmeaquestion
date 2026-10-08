import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { settleFollowUp } from '@/lib/follow-up-settle'

// The expert cancels a confirmed conversation before it starts. The asker is
// never charged.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-expert-action', subject: user.id, limit: 60, windowSeconds: 3600 },
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
    .select('id, status, confirmed_start')
    .eq('id', body.id)
    .eq('expert_id', user.id)
    .maybeSingle()

  if (!call || call.status !== 'confirmed' || !call.confirmed_start) {
    return NextResponse.json(
      { error: 'This conversation can’t be cancelled.' },
      { status: 409 }
    )
  }
  if (Date.now() >= new Date(call.confirmed_start).getTime()) {
    return NextResponse.json(
      {
        error:
          'This conversation has already started. If something went wrong, use “Report a problem”.',
      },
      { status: 409 }
    )
  }

  const result = await settleFollowUp({
    id: call.id,
    from: ['confirmed'],
    outcome: 'cancelled_by_expert',
    reason: 'expert_cancelled',
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
