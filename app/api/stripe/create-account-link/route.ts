import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { logError } from '@/lib/log-error'

export async function POST(request: Request) {
  const { accountId } = await request.json()

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?stripe=return`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    await logError('stripe/create-account-link', err, { accountId })
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}