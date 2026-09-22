import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { logError } from '@/lib/log-error'

export async function POST(request: Request) {
  const { accountId } = await request.json()

  if (!accountId) {
    return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(accountId)
    return NextResponse.json({ url: loginLink.url })
  } catch (err) {
    await logError('stripe/create-login-link', err, { accountId })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
