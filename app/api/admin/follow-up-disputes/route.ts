import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'

// Follow-up conversations held for a decision. No email addresses are
// returned -- the evidence needed is who opened the join page and when.
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { data: rows, error } = await supabaseAdmin
    .from('follow_up_calls')
    .select(
      'id, question_id, expert_id, price_cents, confirmed_start, capture_before, problem_reported_at, problem_reported_by, problem_reason, problem_note, settlement_reason, asker_joined_at, expert_joined_at, captured_at, released_at'
    )
    .eq('status', 'disputed')
    .order('problem_reported_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const open = (rows ?? []).filter((r) => !r.captured_at && !r.released_at)
  const questionIds = [...new Set(open.map((r) => r.question_id))]
  const expertIds = [...new Set(open.map((r) => r.expert_id))]

  const [{ data: questions }, { data: profiles }] = await Promise.all([
    questionIds.length
      ? supabaseAdmin.from('questions').select('id, reference_id').in('id', questionIds)
      : Promise.resolve({ data: [] }),
    expertIds.length
      ? supabaseAdmin.from('profiles').select('id, full_name').in('id', expertIds)
      : Promise.resolve({ data: [] }),
  ])
  // The evidence timeline for each. Tolerant of the table not existing yet.
  const openIds = open.map((r) => r.id)
  const { data: eventRows } = openIds.length
    ? await supabaseAdmin
        .from('follow_up_events')
        .select('follow_up_id, event, actor, detail, created_at')
        .in('follow_up_id', openIds)
        .order('created_at', { ascending: true })
    : { data: [] }
  const eventsById = new Map<string, { event: string; actor: string; detail: unknown; at: string }[]>()
  for (const e of eventRows ?? []) {
    const list = eventsById.get(e.follow_up_id) ?? []
    list.push({ event: e.event, actor: e.actor, detail: e.detail, at: e.created_at })
    eventsById.set(e.follow_up_id, list)
  }
  const ref = new Map((questions ?? []).map((q) => [q.id, q.reference_id]))
  const name = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  return NextResponse.json({
    disputes: open.map((r) => ({
      id: r.id,
      referenceId: ref.get(r.question_id) ?? null,
      expertName: name.get(r.expert_id) ?? 'Expert',
      priceCents: r.price_cents,
      confirmedStart: r.confirmed_start,
      captureBefore: r.capture_before,
      reportedAt: r.problem_reported_at,
      reportedBy: r.problem_reported_by,
      problemReason: r.problem_reason ?? null,
      problemNote: r.problem_note ?? null,
      events: eventsById.get(r.id) ?? [],
      reason: r.settlement_reason,
      askerJoinedAt: r.asker_joined_at,
      expertJoinedAt: r.expert_joined_at,
    })),
  })
}
