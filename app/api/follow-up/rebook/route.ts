import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enforceRateLimit } from '@/lib/rate-limit'
import { cancellationKind, getFollowUpOffer } from '@/lib/follow-up'
import { settleFollowUp } from '@/lib/follow-up-settle'

// "Request a different time". The asker cancels a confirmed conversation
// for free (only possible more than 24 hours ahead) in order to pick new
// times. Their private booking id identifies them, as on the join page.
//
// It first checks that a new request can really be made afterwards -- the
// 14-day offer still open and the expert still offering follow-ups -- so
// nobody cancels and then finds they can't rebook.
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-cancel-asker', limit: 20, windowSeconds: 3600 },
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
    .select('id, question_id, status, confirmed_start')
    .eq('id', body.id)
    .maybeSingle()

  if (!call || call.status !== 'confirmed' || !call.confirmed_start) {
    return NextResponse.json(
      { error: 'This conversation can’t be rescheduled.' },
      { status: 409 }
    )
  }
  if (cancellationKind(call.confirmed_start) !== 'free') {
    return NextResponse.json(
      {
        error:
          'It’s less than 24 hours before the start, so a new time can’t be requested. If something goes wrong on the day, you can report it once the conversation has started.',
      },
      { status: 409 }
    )
  }

  const offer = await getFollowUpOffer(call.question_id, { ignoreBookingId: call.id })
  if (!offer.ok) {
    return NextResponse.json(
      {
        error:
          'A new time can’t be requested for this conversation any more. You can still cancel it for free.',
      },
      { status: 409 }
    )
  }

  const result = await settleFollowUp({
    id: call.id,
    from: ['confirmed'],
    outcome: 'cancelled_by_asker',
    reason: 'asker_requested_new_time',
    actor: 'asker',
    rescheduling: true,
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: 'This conversation has already been updated. Please refresh.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true, url: `/follow-up/${call.question_id}` })
}
