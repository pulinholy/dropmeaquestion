import { supabaseAdmin } from './supabase-admin'
import { logError } from './log-error'
import { FOLLOW_UP_OFFER_DAYS } from './follow-up-rules'

// Re-exported so server code can keep importing everything from one place.
export * from './follow-up-rules'

// Bookings that stop the asker from booking again. awaiting_payment is not
// here on purpose: an unfinished checkout is replaced when they try again.
const BLOCKING_STATUSES = [
  'requested',
  'confirmed',
  'completed',
  'late_cancelled',
  'asker_no_show',
  'disputed',
]


export type FollowUpOffer =
  | {
      ok: true
      question: {
        id: string
        expertId: string
        askerEmail: string
        referenceId: string | null
      }
      expert: {
        fullName: string
        firstName: string
        stripeAccountId: string
      }
      priceCents: number
    }
  | {
      ok: false
      reason: 'not_found' | 'not_offered' | 'offer_expired' | 'unavailable'
      existing?: { status: string }
    }

let loggedOfferFailure = false

// How long after a connection failure the asker can still book the replacement.
export const FOLLOW_UP_REPLACEMENT_DAYS = 7

// Past the 14-day offer period, a conversation that ended because of a
// connection problem may be replaced by ONE more booking:
//  - the failure must be recent (within FOLLOW_UP_REPLACEMENT_DAYS),
//  - it must be the only such failure for this question, so a replacement that
//    fails again isn't replaced again, and
//  - no replacement may have been requested yet (an abandoned checkout doesn't
//    count).
export async function replacementBookingOpen(questionId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, status, settlement_reason, cancelled_at, created_at, requested_at')
    .eq('question_id', questionId)
    .order('created_at', { ascending: true })
  if (error || !data) return false

  const failures = data.filter(
    (r) =>
      r.status === 'cancelled' &&
      typeof r.settlement_reason === 'string' &&
      r.settlement_reason.endsWith('_rescheduled_technical')
  )
  if (failures.length !== 1) return false

  const failure = failures[0]
  const failedAt = new Date(failure.cancelled_at ?? failure.created_at).getTime()
  if (Date.now() > failedAt + FOLLOW_UP_REPLACEMENT_DAYS * 24 * 3600 * 1000) return false

  return !data.some((r) => r.id !== failure.id && r.created_at > failure.created_at && r.requested_at)
}

// Decides whether this question's asker may be offered a follow-up call. Any
// trouble reading the data means "no offer" -- never an offer that might not
// be honoured.
export async function getFollowUpOffer(
  questionId: string,
  // When an asker is replacing a booking they're about to cancel, that
  // booking mustn't count as blocking the new one.
  options: {
    ignoreBookingId?: string
    // Offer as if the 14-day offer period were still open. Used when working
    // out whether a replacement can still be booked after a technical failure.
    allowExpired?: boolean
  } = {}
): Promise<FollowUpOffer> {
  try {
    const { data: question } = await supabaseAdmin
      .from('questions')
      .select('id, expert_id, asker_email, reference_id, status, answered_at')
      .eq('id', questionId)
      .maybeSingle()

    if (!question || !question.asker_email) return { ok: false, reason: 'not_found' }
    if (question.status !== 'answered' || !question.answered_at) {
      return { ok: false, reason: 'not_offered' }
    }

    const answeredAt = new Date(
      /[zZ]|[+-]\d{2}:?\d{2}$/.test(question.answered_at)
        ? question.answered_at
        : `${question.answered_at}Z`
    )
    const offerEndsAt = answeredAt.getTime() + FOLLOW_UP_OFFER_DAYS * 24 * 3600 * 1000
    if (Date.now() > offerEndsAt && !options.allowExpired) {
      // One exception: a conversation that ended because of a connection
      // problem can be replaced by one more booking, for a short while.
      if (!(await replacementBookingOpen(questionId))) {
        return { ok: false, reason: 'offer_expired' }
      }
    }

    // The expert can switch the offer off for a single answer. A separate
    // query so the offer still works before supabase/follow_up_per_answer.sql
    // has been run (the read just fails and nothing is opted out).
    const { data: optOut } = await supabaseAdmin
      .from('questions')
      .select('follow_up_opted_out')
      .eq('id', questionId)
      .maybeSingle()
    if (optOut?.follow_up_opted_out) return { ok: false, reason: 'not_offered' }

    const { data: expert } = await supabaseAdmin
      .from('experts')
      .select(
        'follow_up_allowed, follow_up_enabled, follow_up_price_cents, stripe_account_id, stripe_onboarded, deactivated_at'
      )
      .eq('id', question.expert_id)
      .maybeSingle()

    if (
      !expert ||
      !expert.follow_up_allowed ||
      !expert.follow_up_enabled ||
      !expert.follow_up_price_cents ||
      !expert.stripe_onboarded ||
      !expert.stripe_account_id ||
      expert.deactivated_at
    ) {
      return { ok: false, reason: 'not_offered' }
    }

    let blockingQuery = supabaseAdmin
      .from('follow_up_calls')
      .select('status')
      .eq('question_id', questionId)
      .in('status', BLOCKING_STATUSES)
    if (options.ignoreBookingId) blockingQuery = blockingQuery.neq('id', options.ignoreBookingId)
    const { data: blocking, error: blockingError } = await blockingQuery.limit(1)
    if (blockingError) throw blockingError
    if (blocking && blocking.length > 0) {
      return { ok: false, reason: 'not_offered', existing: { status: blocking[0].status } }
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', question.expert_id)
      .maybeSingle()
    const fullName = profile?.full_name || 'the expert'

    return {
      ok: true,
      question: {
        id: question.id,
        expertId: question.expert_id,
        askerEmail: question.asker_email,
        referenceId: question.reference_id,
      },
      expert: {
        fullName,
        firstName: fullName.split(' ')[0] || fullName,
        stripeAccountId: expert.stripe_account_id,
      },
      priceCents: expert.follow_up_price_cents,
    }
  } catch (err) {
    if (!loggedOfferFailure) {
      loggedOfferFailure = true
      await logError('follow-up:offer', err, { questionId })
    }
    return { ok: false, reason: 'unavailable' }
  }
}
