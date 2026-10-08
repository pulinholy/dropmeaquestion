import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'
import { enforceRateLimit } from '@/lib/rate-limit'
import { APP_BASE_URL } from '@/lib/site'
import { logFollowUpEvent } from '@/lib/follow-up-events'
import { videoMode } from '@/lib/video/config'
import {
  FOLLOW_UP_PLATFORM_FEE_RATE,
  followUpPolicyLines,
  followUpPolicyVersion,
  getFollowUpOffer,
  validateProposedSlots,
} from '@/lib/follow-up'

const CHECKOUT_LIFETIME_MINUTES = 30

function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

// Starts a follow-up conversation request: records what the asker proposed and
// agreed to, then sends them to Stripe to authorize (hold, not charge) the
// card. The booking only becomes a request once the hold succeeds.
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-request', limit: 10, windowSeconds: 600 },
  ])
  if (limited) return limited

  let body: {
    questionId?: unknown
    slots?: unknown
    timezone?: unknown
    acceptedPolicy?: unknown
    policyVersion?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (typeof body.questionId !== 'string') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  // The policy text depends on whether DMQ rooms are on, so the version the
  // asker agreed to must be the one this server would show right now.
  const mode = videoMode()
  const policyVersion = followUpPolicyVersion(mode)
  if (body.acceptedPolicy !== true || body.policyVersion !== policyVersion) {
    return NextResponse.json(
      { error: 'Please read and agree to the cancellation policy to continue.' },
      { status: 400 }
    )
  }

  const slotCheck = validateProposedSlots(body.slots)
  if (!slotCheck.ok) {
    return NextResponse.json({ error: slotCheck.error }, { status: 400 })
  }

  const offer = await getFollowUpOffer(body.questionId)
  if (!offer.ok) {
    return NextResponse.json(
      { error: 'A conversation can’t be booked for this question right now.' },
      { status: 400 }
    )
  }

  // A new attempt replaces an unfinished earlier checkout, so closing the
  // payment page never locks the asker out. A paid one is left alone.
  const { data: unfinished } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, stripe_checkout_session_id')
    .eq('question_id', offer.question.id)
    .eq('status', 'awaiting_payment')

  for (const row of unfinished ?? []) {
    try {
      if (row.stripe_checkout_session_id) {
        const session = await stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id)
        if (session.status === 'complete') {
          return NextResponse.json(
            { error: 'Your earlier request is still being processed. Please check your email.' },
            { status: 409 }
          )
        }
        if (session.status === 'open') {
          await stripe.checkout.sessions.expire(row.stripe_checkout_session_id)
        }
      }
    } catch (err) {
      await logError('follow-up/request:replace-unfinished', err, { followUpId: row.id })
    }
    await supabaseAdmin
      .from('follow_up_calls')
      .update({ status: 'expired', released_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'awaiting_payment')
  }

  const priceCents = offer.priceCents
  const platformFee = Math.round(priceCents * FOLLOW_UP_PLATFORM_FEE_RATE)

  const { data: created, error: insertError } = await supabaseAdmin
    .from('follow_up_calls')
    .insert({
      question_id: offer.question.id,
      expert_id: offer.question.expertId,
      status: 'awaiting_payment',
      price_cents: priceCents,
      platform_fee_cents: platformFee,
      asker_timezone: isValidTimezone(body.timezone) ? body.timezone : null,
      proposed_slots: slotCheck.slots,
      policy_version: policyVersion,
    })
    .select('id')
    .single()

  if (insertError || !created) {
    // 23505: another live booking already exists for this question.
    if ((insertError as { code?: string } | null)?.code === '23505') {
      return NextResponse.json(
        { error: 'A conversation has already been requested for this question.' },
        { status: 409 }
      )
    }
    await logError('follow-up/request:insert', insertError, { questionId: offer.question.id })
    return NextResponse.json(
      { error: 'Could not start your request. Please try again.' },
      { status: 500 }
    )
  }

  await logFollowUpEvent(created.id, 'policy_accepted', 'asker', {
    policy_version: policyVersion,
    price_cents: priceCents,
    proposed_slots: slotCheck.slots,
  })

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: offer.question.askerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `15-minute conversation with ${offer.expert.firstName}`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        capture_method: 'manual',
        application_fee_amount: platformFee,
        transfer_data: { destination: offer.expert.stripeAccountId },
        metadata: { followUpId: created.id },
      },
      metadata: { followUpId: created.id },
      custom_text: {
        submit: { message: followUpPolicyLines(mode).join(' ').slice(0, 1200) },
      },
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_LIFETIME_MINUTES * 60,
      success_url: `${APP_BASE_URL}/follow-up/${offer.question.id}?requested=1`,
      cancel_url: `${APP_BASE_URL}/follow-up/${offer.question.id}`,
    })

    await supabaseAdmin
      .from('follow_up_calls')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', created.id)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    // Nothing was authorized; don't leave an orphaned booking in the way.
    await supabaseAdmin.from('follow_up_calls').delete().eq('id', created.id)
    await logError('follow-up/request:stripe', err, { questionId: offer.question.id })
    return NextResponse.json(
      { error: 'Could not start your payment. Please try again.' },
      { status: 500 }
    )
  }
}
