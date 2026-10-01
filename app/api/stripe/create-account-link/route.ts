import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { logError } from '@/lib/log-error'

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
    const accountLink = await stripe.accountLinks.create({
      account: expert.stripe_account_id,
      refresh_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?stripe=return`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    await logError('stripe/create-account-link', err, { expertId: user.id })
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
