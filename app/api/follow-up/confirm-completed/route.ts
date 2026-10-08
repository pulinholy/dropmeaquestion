import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enforceRateLimit } from '@/lib/rate-limit'
import { reviewOpensAt } from '@/lib/follow-up'
import { settleFollowUp } from '@/lib/follow-up-settle'

// The asker confirms the conversation took place. Their private booking id is
// the proof it's them (they have no login). It charges the card now, so it is
// only accepted once the 15-minute slot is over.
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-confirm-asker', limit: 20, windowSeconds: 3600 },
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
    .maybeSingle()

  if (!call || call.status !== 'confirmed' || !call.confirmed_start) {
    return NextResponse.json(
      { error: 'This conversation can’t be confirmed.' },
      { status: 409 }
    )
  }
  if (Date.now() < reviewOpensAt(call.confirmed_start).getTime()) {
    return NextResponse.json(
      { error: 'Please confirm once the conversation has ended.' },
      { status: 409 }
    )
  }

  const result = await settleFollowUp({
    id: call.id,
    from: ['confirmed'],
    outcome: 'completed',
    reason: 'asker_confirmed_completed',
    actor: 'asker',
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: 'This conversation has already been updated. Please refresh.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true })
}
