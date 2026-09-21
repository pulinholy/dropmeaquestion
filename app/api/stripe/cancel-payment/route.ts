import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  const { paymentIntentId } = await request.json()

  if (!paymentIntentId) {
    return NextResponse.json({ error: 'No payment intent provided' }, { status: 400 })
  }

  try {
    await stripe.paymentIntents.cancel(paymentIntentId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Stripe cancel error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}