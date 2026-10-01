import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { logError } from '@/lib/log-error'

// Backstop for the account.updated webhook, same pattern as payment
// reconciliation -- called when the expert lands back on the dashboard after
// Stripe onboarding, so a missed or delayed webhook doesn't leave them stuck
// looking at "Connect Stripe" when the account is actually ready.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const { data: expert } = await supabaseAdmin
    .from('experts')
    .select('stripe_account_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!expert?.stripe_account_id) {
    return NextResponse.json({ error: 'No connected Stripe account' }, { status: 404 })
  }

  try {
    const account = await stripe.accounts.retrieve(expert.stripe_account_id)
    const isOnboarded = Boolean(account.charges_enabled && account.payouts_enabled)

    const { error } = await supabaseAdmin
      .from('experts')
      .update({ stripe_onboarded: isOnboarded })
      .eq('id', user.id)

    if (error) {
      await logError('stripe/sync-account-status', error, { expertId: user.id })
    }

    return NextResponse.json({ stripeOnboarded: isOnboarded })
  } catch (err) {
    await logError('stripe/sync-account-status', err, { expertId: user.id })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
