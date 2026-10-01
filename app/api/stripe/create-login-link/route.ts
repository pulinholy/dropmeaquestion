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
    const loginLink = await stripe.accounts.createLoginLink(expert.stripe_account_id)
    return NextResponse.json({ url: loginLink.url })
  } catch (err) {
    await logError('stripe/create-login-link', err, { expertId: user.id })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
