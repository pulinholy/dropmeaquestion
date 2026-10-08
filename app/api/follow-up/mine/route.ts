import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'

// The signed-in expert's follow-up conversations. The table is server-only, so
// the dashboard reads it through here. The asker's email is never included.
// "available: false" means the feature's tables aren't set up in this
// environment yet -- the dashboard simply hides it.
export async function GET(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const unavailable = { available: false, enabled: false, calls: [] }

  const { data: expert, error: expertError } = await supabaseAdmin
    .from('experts')
    .select('follow_up_enabled')
    .eq('id', user.id)
    .maybeSingle()
  if (expertError || !expert) return NextResponse.json(unavailable)

  const { data: rows, error } = await supabaseAdmin
    .from('follow_up_calls')
    .select(
      'id, question_id, status, price_cents, proposed_slots, confirmed_start, meeting_link, confirm_by, asker_timezone, cancelled_by, requested_at, completed_at, asker_joined_at, expert_joined_at, created_at'
    )
    .eq('expert_id', user.id)
    .neq('status', 'awaiting_payment')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json(unavailable)

  const questionIds = [...new Set((rows ?? []).map((r) => r.question_id))]
  const { data: questions } = questionIds.length
    ? await supabaseAdmin.from('questions').select('id, reference_id').in('id', questionIds)
    : { data: [] }
  const referenceById = new Map((questions ?? []).map((q) => [q.id, q.reference_id]))

  return NextResponse.json({
    available: true,
    enabled: Boolean(expert.follow_up_enabled),
    calls: (rows ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      priceCents: r.price_cents,
      referenceId: referenceById.get(r.question_id) ?? null,
      proposedSlots: r.proposed_slots,
      confirmedStart: r.confirmed_start,
      meetingLink: r.status === 'confirmed' ? r.meeting_link : null,
      confirmBy: r.confirm_by,
      askerTimezone: r.asker_timezone,
      cancelledBy: r.cancelled_by,
      requestedAt: r.requested_at,
      completedAt: r.completed_at,
      askerJoined: Boolean(r.asker_joined_at),
      expertJoined: Boolean(r.expert_joined_at),
      createdAt: r.created_at,
    })),
  })
}
