import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { logError } from '@/lib/log-error'

export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user || !user.email) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const { data: expert } = await supabaseAdmin
    .from('experts')
    .select('stripe_account_id')
    .eq('id', user.id)
    .maybeSingle()

  if (expert?.stripe_account_id) {
    return NextResponse.json({ accountId: expert.stripe_account_id })
  }

  try {
    const account = await stripe.accounts.create({
      country: 'US',
      email: user.email,
      controller: {
        stripe_dashboard: {
          type: 'express',
        },
        fees: {
          payer: 'application',
        },
        losses: {
          payments: 'application',
        },
        requirement_collection: 'stripe',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })

    return NextResponse.json({ accountId: account.id })
  } catch (err) {
    await logError('stripe/create-account', err, { expertId: user.id })
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
