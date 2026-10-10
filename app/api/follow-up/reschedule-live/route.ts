import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import {
  FOLLOW_UP_CONNECTION_FAILURE_SECONDS,
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
// closes), and only if the two had little or no time together:
//   no connection data, or under 2 minutes together: a new time at no charge
//   2 to 10 minutes together: refused here; report a problem for a review
//   10 minutes or more: refused; it counts, so the normal completion applies
// An asker can't use it while the expert has been waiting in the conversation
// (that is an asker no-show, decided by the usual rules). So it can't be used
// to avoid paying for time the other person gave. An expert sends their login token; the asker's private booking
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
    return NextResponse.json({ error: 'A new time can’t be requested for this conversation.' }, { status: 409 })
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
    return NextResponse.json({ error: 'A new time can’t be requested for this conversation.' }, { status: 409 })
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
      { error: 'The conversation has ended, so a new time can’t be requested this way. You can report a problem instead.' },
      { status: 409 }
    )
  }

  // Connection records, counted up to this moment (the conversation is live).
  let sharedSeconds = 0
  let expertSeconds = 0
  let anySessions = false
  try {
    const summary = await loadConnectionSummary(call.id, call.confirmed_start, new Date())
    sharedSeconds = summary.sharedSeconds
    expertSeconds = summary.expert.totalSeconds
    anySessions = summary.anySessions
  } catch {
    // Treated as no data.
  }
  const minutes = Math.max(1, Math.round(sharedSeconds / 60))
  if (sharedSeconds >= FOLLOW_UP_MIN_SHARED_SECONDS) {
    return NextResponse.json(
      {
        error:
          'You have already spent enough time together for this conversation to count, so this can’t be used. If something went wrong, report a problem instead.',
      },
      { status: 409 }
    )
  }
  if (sharedSeconds >= FOLLOW_UP_CONNECTION_FAILURE_SECONDS) {
    return NextResponse.json(
      {
        error: `You were connected together for about ${minutes} minute${minutes === 1 ? '' : 's'}, so this needs a quick review before any payment decision. Use Report a problem and choose “I couldn’t connect to the call”.`,
      },
      { status: 409 }
    )
  }
  if (role === 'asker' && expertSeconds >= FOLLOW_UP_CONNECTION_FAILURE_SECONDS) {
    return NextResponse.json(
      {
        error:
          'The expert has been waiting in the conversation, so this can’t be done automatically. If something went wrong, use Report a problem and we’ll review it before any payment decision.',
      },
      { status: 409 }
    )
  }

  // Whether the asker can still book again: within the 14-day offer period, or,
  // past it, once: a conversation that fails because of a connection problem
  // may be replaced by one more booking. A question that has already had one
  // such failure gets no further exception.
  let rebookAvailable = false
  const offer = await getFollowUpOffer(call.question_id, { ignoreBookingId: call.id })
  if (offer.ok) {
    rebookAvailable = true
  } else if (offer.reason === 'offer_expired') {
    const { count: earlierFailures } = await supabaseAdmin
      .from('follow_up_calls')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', call.question_id)
      .neq('id', call.id)
      .like('settlement_reason', '%_rescheduled_technical')
    if ((earlierFailures ?? 0) === 0) {
      const exception = await getFollowUpOffer(call.question_id, {
        ignoreBookingId: call.id,
        allowExpired: true,
      })
      rebookAvailable = exception.ok
    }
  }

  const result = await settleFollowUp({
    id: call.id,
    from: ['confirmed'],
    outcome: 'technical_reschedule',
    reason: `${role}_rescheduled_technical`,
    actor: role,
    expertId,
    rebookAvailable,
    // Kept so unusual use (many reschedules, or none with connection data) shows
    // up in the admin Video card.
    detail: { shared_seconds: sharedSeconds, no_connection_data: !anySessions },
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
