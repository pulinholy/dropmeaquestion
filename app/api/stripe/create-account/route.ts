import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

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
  console.error('Stripe create-account error:', err)
  return NextResponse.json(
    { error: (err as Error).message },
    { status: 500 }
  )
}
}