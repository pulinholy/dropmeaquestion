import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'
import { sendNewExpertAlert } from '@/lib/send-new-expert-alert'

// How long after signing up a person can still trigger the alert. Email
// confirmation can delay creating the page, so this is generous.
const NEW_ACCOUNT_DAYS = 14

// Called by the browser right after an expert's page is created. It emails the
// admins once per new expert. The details are read from the database, not from
// the request, and each account can trigger it at most once.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0
  if (Date.now() - createdAt > NEW_ACCOUNT_DAYS * 24 * 3600 * 1000) {
    return NextResponse.json({ sent: false })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'notify-new-expert', subject: user.id, limit: 1, windowSeconds: 30 * 24 * 3600 },
  ])
  if (limited) return NextResponse.json({ sent: false })

  const [{ data: profile }, { data: expert }, { data: topics }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('full_name, username, is_expert')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('experts')
      .select('headline, price_cents, response_window_hours')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('expert_topics')
      .select('name')
      .eq('expert_id', user.id)
      .order('sort_order'),
  ])

  if (!profile?.is_expert || !expert) {
    return NextResponse.json({ sent: false })
  }

  try {
    await sendNewExpertAlert({
      fullName: profile.full_name,
      username: profile.username,
      email: user.email ?? null,
      headline: expert.headline,
      priceCents: expert.price_cents,
      responseWindowHours: expert.response_window_hours,
      topics: (topics ?? []).map((t) => t.name),
    })
  } catch (err) {
    await logError('notify-new-expert', err, { expertId: user.id })
  }

  return NextResponse.json({ sent: true })
}
