import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { logError } from '@/lib/log-error'

export async function POST(request: Request) {
  const { email } = await request.json()

  try {
    const account = await stripe.accounts.create({
      country: 'US',
      email,
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
  await logError('stripe/create-account', err, { email })
  return NextResponse.json(
    { error: (err as Error).message },
    { status: 500 }
  )
}
}