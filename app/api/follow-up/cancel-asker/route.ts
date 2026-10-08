import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enforceRateLimit } from '@/lib/rate-limit'
import { cancellationKind, formatPrice } from '@/lib/follow-up'
import { settleFollowUp } from '@/lib/follow-up-settle'

// The asker cancels a confirmed conversation. More than 24 hours ahead it's
// free (the hold is released). Inside 24 hours they're charged in full -- but
// only after they've explicitly acknowledged that, so it can never happen by
// accident. Once the start time has passed it's too late to cancel.
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-cancel-asker', limit: 20, windowSeconds: 3600 },
  ])
  if (limited) return limited

  let body: { id?: unknown; acknowledgeLateCharge?: unknown }
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
    .select('id, status, confirmed_start, price_cents')
    .eq('id', body.id)
    .maybeSingle()

  if (!call || call.status !== 'confirmed' || !call.confirmed_start) {
    return NextResponse.json(
      { error: 'This conversation can’t be cancelled.' },
      { status: 409 }
    )
  }

  const kind = cancellationKind(call.confirmed_start)
  if (kind === 'started') {
    return NextResponse.json(
      {
        error:
          'This conversation has already started, so it can’t be cancelled. If something went wrong, use “Report a problem”.',
      },
      { status: 409 }
    )
  }
  if (kind === 'late' && body.acknowledgeLateCharge !== true) {
    return NextResponse.json(
      {
        error: `Cancelling now charges your card $${formatPrice(call.price_cents)} in full, as described in the cancellation policy.`,
        needsAcknowledge: true,
      },
      { status: 409 }
    )
  }

  const result = await settleFollowUp({
    id: call.id,
    from: ['confirmed'],
    outcome: kind === 'free' ? 'cancelled_by_asker' : 'late_cancelled',
    reason: kind === 'free' ? 'asker_cancelled_free' : 'asker_cancelled_late',
    actor: 'asker',
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: 'This conversation has already been updated. Please refresh.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true, charged: kind === 'late' })
}
