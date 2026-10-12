import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { FOLLOW_UP_PLATFORM_FEE_RATE } from '@/lib/follow-up-rules'

// What the signed-in expert has earned from follow-up conversations. A
// conversation counts once its payment was actually taken (captured_at is set
// only when Stripe confirms), so a booking that is still to come, under review
// or released earns nothing. The table is server-only, so the dashboard reads
// it through here. Any trouble reading it means "no conversations", never an
// error that would hide the expert's other earnings.
export async function GET(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const empty = { available: false, conversations: [] }

  const { data: expert, error: expertError } = await supabaseAdmin
    .from('experts')
    .select('follow_up_allowed')
    .eq('id', user.id)
    .maybeSingle()
  if (expertError || !expert) return NextResponse.json(empty)

  const { data: rows, error } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, question_id, status, price_cents, platform_fee_cents, captured_at')
    .eq('expert_id', user.id)
    .not('captured_at', 'is', null)
    .order('captured_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ available: Boolean(expert.follow_up_allowed), conversations: [] })

  const questionIds = [...new Set((rows ?? []).map((r) => r.question_id))]
  const { data: questions } = questionIds.length
    ? await supabaseAdmin.from('questions').select('id, reference_id').in('id', questionIds)
    : { data: [] }
  const referenceById = new Map((questions ?? []).map((q) => [q.id, q.reference_id]))

  return NextResponse.json({
    available: Boolean(expert.follow_up_allowed),
    conversations: (rows ?? []).map((r) => {
      const gross = r.price_cents ?? 0
      const fee = r.platform_fee_cents ?? Math.round(gross * FOLLOW_UP_PLATFORM_FEE_RATE)
      return {
        id: r.id,
        referenceId: referenceById.get(r.question_id) ?? null,
        outcome: r.status,
        paidAt: r.captured_at,
        grossCents: gross,
        netCents: gross - fee,
      }
    }),
  })
}
