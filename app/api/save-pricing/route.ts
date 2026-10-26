import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { checkFollowUpPrice, checkQuestionPrice } from '@/lib/pricing'

const RESPONSE_WINDOWS = [24, 48]

// Saves the signed-in expert's prices and response time. The price rules (whole
// dollars, $5-$500 for questions and $15-$100 for conversations) are checked
// here as well as on the page, so they hold whatever the page sends.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'save-pricing', subject: user.id, limit: 60, windowSeconds: 3600 },
  ])
  if (limited) return limited

  let body: {
    price?: unknown
    responseWindowHours?: unknown
    followUp?: { enabled?: unknown; price?: unknown } | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const priceCheck = checkQuestionPrice(String(body.price ?? ''))
  if (!priceCheck.ok) {
    return NextResponse.json({ error: priceCheck.message }, { status: 400 })
  }
  const windowHours = Number(body.responseWindowHours)
  if (!RESPONSE_WINDOWS.includes(windowHours)) {
    return NextResponse.json({ error: 'Choose a response time from the list.' }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('experts')
    .update({
      price_cents: priceCheck.dollars * 100,
      response_window_hours: windowHours,
    })
    .eq('id', user.id)
  if (updateError) {
    return NextResponse.json({ error: 'Could not save your pricing. Please try again.' }, { status: 500 })
  }

  // Follow-up conversation settings, only for experts who have them.
  if (body.followUp && typeof body.followUp === 'object') {
    const { data: expert } = await supabaseAdmin
      .from('experts')
      .select('follow_up_allowed')
      .eq('id', user.id)
      .maybeSingle()
    if (expert?.follow_up_allowed) {
      const enabled = body.followUp.enabled === true
      const followUpCheck = checkFollowUpPrice(String(body.followUp.price ?? ''))
      if (enabled && !followUpCheck.ok) {
        return NextResponse.json({ error: followUpCheck.message }, { status: 400 })
      }
      const { error: followUpError } = await supabaseAdmin
        .from('experts')
        .update({
          follow_up_enabled: enabled,
          // A valid price stays on file even while switched off, so turning
          // it back on remembers it.
          follow_up_price_cents: followUpCheck.ok ? followUpCheck.dollars * 100 : null,
        })
        .eq('id', user.id)
      if (followUpError) {
        return NextResponse.json(
          { error: 'Could not save your conversation settings. Please try again.' },
          { status: 500 }
        )
      }
    }
  }

  return NextResponse.json({ success: true })
}
