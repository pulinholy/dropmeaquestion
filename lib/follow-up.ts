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

const STRIKE_LIMIT = 3
const STRIKE_WINDOW_DAYS = 90

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

// Decides whether this question's asker may be offered a follow-up call. Any
// trouble reading the data means "no offer" -- never an offer that might not
// be honoured.
export async function getFollowUpOffer(questionId: string): Promise<FollowUpOffer> {
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
    if (Date.now() > offerEndsAt) return { ok: false, reason: 'offer_expired' }

    const { data: expert } = await supabaseAdmin
      .from('experts')
      .select(
        'follow_up_enabled, follow_up_price_cents, stripe_account_id, stripe_onboarded, deactivated_at'
      )
      .eq('id', question.expert_id)
      .maybeSingle()

    if (
      !expert ||
      !expert.follow_up_enabled ||
      !expert.follow_up_price_cents ||
      !expert.stripe_onboarded ||
      !expert.stripe_account_id ||
      expert.deactivated_at
    ) {
      return { ok: false, reason: 'not_offered' }
    }

    const { data: blocking, error: blockingError } = await supabaseAdmin
      .from('follow_up_calls')
      .select('status')
      .eq('question_id', questionId)
      .in('status', BLOCKING_STATUSES)
      .limit(1)
    if (blockingError) throw blockingError
    if (blocking && blocking.length > 0) {
      return { ok: false, reason: 'not_offered', existing: { status: blocking[0].status } }
    }

    // Three strikes (the expert cancelled or didn't join) turns the offer off.
    const since = new Date(Date.now() - STRIKE_WINDOW_DAYS * 24 * 3600 * 1000).toISOString()
    const { data: strikes, error: strikesError } = await supabaseAdmin
      .from('follow_up_calls')
      .select('id, status, cancelled_by')
      .eq('expert_id', question.expert_id)
      .gte('created_at', since)
      .or('status.eq.expert_no_show,and(status.eq.cancelled,cancelled_by.eq.expert)')
    if (strikesError) throw strikesError
    if ((strikes?.length ?? 0) >= STRIKE_LIMIT) return { ok: false, reason: 'not_offered' }

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
