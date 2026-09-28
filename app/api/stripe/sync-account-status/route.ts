import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'

// Backstop for the account.updated webhook, same pattern as payment
// reconciliation -- called when the expert lands back on the dashboard after
// Stripe onboarding, so a missed or delayed webhook doesn't leave them stuck
// looking at "Connect Stripe" when the account is actually ready.
export async function POST(request: Request) {
  const { accountId } = await request.json()

  if (!accountId) {
    return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
  }

  try {
    const account = await stripe.accounts.retrieve(accountId)
    const isOnboarded = Boolean(account.charges_enabled && account.payouts_enabled)

    const { error } = await supabaseAdmin
      .from('experts')
      .update({ stripe_onboarded: isOnboarded })
      .eq('stripe_account_id', accountId)

    if (error) {
      await logError('stripe/sync-account-status', error, { accountId })
    }

    return NextResponse.json({ stripeOnboarded: isOnboarded })
  } catch (err) {
    await logError('stripe/sync-account-status', err, { accountId })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
