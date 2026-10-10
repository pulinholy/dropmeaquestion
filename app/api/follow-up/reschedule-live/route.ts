import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import {
  FOLLOW_UP_MIN_SHARED_SECONDS,
  getFollowUpOffer,
  videoRoomWindowFor,
} from '@/lib/follow-up'
import { settleFollowUp } from '@/lib/follow-up-settle'
import { videoMode } from '@/lib/video/config'
import { loadConnectionSummary } from '@/lib/video/settlement'

// "Reschedule for free": either side ends a conversation held on DMQ because of
// a connection problem. The card is released, nobody is at fault, and both are
// emailed (the asker with a link to book again, if that is still possible).
//
// Only while the conversation is running (from the start until the room
// closes), and not once the two have already spent the automatic-completion
// time together, so it can't be used to avoid paying for a conversation that
// took place. An expert sends their login token; the asker's private booking
// id identifies them, as on the join page.
export async function POST(request: Request) {
  let body: { id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  let role: 'asker' | 'expert' = 'asker'
  let expertId: string | undefined
  if (request.headers.get('authorization')) {
    const user = await requireUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }
    role = 'expert'
    expertId = user.id
  }

  const limited = await enforceRateLimit(
    request,
    role === 'expert'
      ? [{ name: 'follow-up-expert-action', subject: expertId, limit: 60, windowSeconds: 3600 }]
      : [{ name: 'follow-up-report-asker', limit: 20, windowSeconds: 3600 }]
  )
  if (limited) return limited

  if (videoMode() !== 'dmq') {
    return NextResponse.json({ error: 'This conversation can’t be rescheduled.' }, { status: 409 })
  }

  let query = supabaseAdmin
    .from('follow_up_calls')
    .select('id, question_id, status, video_provider, confirmed_start')
    .eq('id', body.id)
  if (expertId) query = query.eq('expert_id', expertId)
  const { data: call } = await query.maybeSingle()

  if (
    !call ||
    call.status !== 'confirmed' ||
    call.video_provider !== 'dmq' ||
    !call.confirmed_start
  ) {
    return NextResponse.json({ error: 'This conversation can’t be rescheduled.' }, { status: 409 })
  }

  const now = Date.now()
  const { closesAt } = videoRoomWindowFor(call.confirmed_start)
  if (now < new Date(call.confirmed_start).getTime()) {
    return NextResponse.json(
      {
        error:
          'This can be used once the conversation has started. To change plans before then, cancel it instead.',
      },
      { status: 409 }
    )
  }
  if (now > closesAt.getTime()) {
    return NextResponse.json(
      { error: 'The conversation has ended, so it can’t be rescheduled. You can report a problem instead.' },
      { status: 409 }
    )
  }

  // If we have connection records and the two were together long enough for
  // the conversation to count, refuse. With no records, the reschedule is
  // allowed and recorded.
  let sharedSeconds = 0
  try {
    sharedSeconds = (await loadConnectionSummary(call.id, call.confirmed_start)).sharedSeconds
  } catch {
    // Treated as no data.
  }
  if (sharedSeconds >= FOLLOW_UP_MIN_SHARED_SECONDS) {
    return NextResponse.json(
      {
        error:
          'You have already spent enough time together for this conversation to count. If something went wrong, report a problem instead.',
      },
      { status: 409 }
    )
  }

  // Whether the asker can still book again (the 14-day offer period).
  const offer = await getFollowUpOffer(call.question_id, { ignoreBookingId: call.id })
  const rebookAvailable = offer.ok

  const result = await settleFollowUp({
    id: call.id,
    from: ['confirmed'],
    outcome: 'technical_reschedule',
    reason: `${role}_rescheduled_technical`,
    actor: role,
    expertId,
    rebookAvailable,
    detail: { shared_seconds: sharedSeconds },
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: 'This conversation has already been updated. Please refresh.' },
      { status: 409 }
    )
  }

  return NextResponse.json({
    ok: true,
    rebookUrl: rebookAvailable ? `/follow-up/${call.question_id}` : null,
  })
}
