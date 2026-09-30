import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'
import { logError } from '@/lib/log-error'

// Matches the split used at checkout/capture time (see
// stripe/create-checkout and dashboard/payments) -- kept in sync manually
// since it's not stored anywhere per-transaction beyond the gross price.
const EXPERT_NET_RATE = 0.85

// Never happened as a real, paid question -- excluded from "received".
const UNREALIZED_STATUSES = new Set(['awaiting_payment', 'payment_abandoned'])

export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  try {
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, avatar_url, created_at')
      .order('created_at', { ascending: false })
    if (profilesErr) throw profilesErr

    const { data: experts, error: expertsErr } = await supabaseAdmin
      .from('experts')
      .select('id, is_active, stripe_onboarded, deactivated_at')
    if (expertsErr) throw expertsErr
    const expertById = new Map(experts?.map((e) => [e.id, e]) ?? [])

    const { data: questions, error: questionsErr } = await supabaseAdmin
      .from('questions')
      .select('expert_id, status, price_cents')
    if (questionsErr) throw questionsErr

    const { data: usersRes, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    })
    if (usersErr) throw usersErr
    const emailById = new Map(usersRes.users.map((u) => [u.id, u.email]))

    type Stats = {
      received: number
      answered: number
      expertEarnedCents: number
      dmqEarnedCents: number
    }
    const statsByExpert = new Map<string, Stats>()

    for (const q of questions ?? []) {
      if (!expertById.has(q.expert_id)) continue // orphaned/deleted expert

      const s: Stats = statsByExpert.get(q.expert_id) ?? {
        received: 0,
        answered: 0,
        expertEarnedCents: 0,
        dmqEarnedCents: 0,
      }

      if (!UNREALIZED_STATUSES.has(q.status)) {
        s.received += 1
      }

      if (q.status === 'answered') {
        s.answered += 1
        const gross = q.price_cents ?? 0
        const net = Math.round(gross * EXPERT_NET_RATE)
        s.expertEarnedCents += net
        s.dmqEarnedCents += gross - net
      }

      statsByExpert.set(q.expert_id, s)
    }

    const rows = (profiles ?? [])
      .filter((p) => expertById.has(p.id))
      .map((p) => {
        const s = statsByExpert.get(p.id) ?? {
          received: 0,
          answered: 0,
          expertEarnedCents: 0,
          dmqEarnedCents: 0,
        }
        const expert = expertById.get(p.id)

        return {
          id: p.id,
          fullName: p.full_name,
          username: p.username,
          avatarUrl: p.avatar_url,
          email: emailById.get(p.id) ?? null,
          isActive: expert?.is_active ?? false,
          stripeOnboarded: expert?.stripe_onboarded ?? false,
          deactivatedAt: expert?.deactivated_at ?? null,
          questionsReceived: s.received,
          questionsAnswered: s.answered,
          expertEarnedCents: s.expertEarnedCents,
          dmqEarnedCents: s.dmqEarnedCents,
        }
      })

    return NextResponse.json({ experts: rows })
  } catch (err) {
    await logError('admin/experts-summary', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
