import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { settleFollowUp } from '@/lib/follow-up-settle'
import { parseProblemReport } from '@/lib/follow-up-rules'

// Either side reports that something went wrong once the start time has
// begun (the other person didn't show, the call failed, ...). Nothing is
// charged or released automatically: the booking is held for a person to
// decide, and the support inbox is alerted.
//
// An expert sends their login token; the asker has none, so their private
// booking id identifies them. A token that is present but invalid is rejected,
// never quietly treated as an asker.
export async function POST(request: Request) {
  let body: { id?: unknown; reason?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const report = parseProblemReport(body)
  if (!report.ok) {
    return NextResponse.json({ error: report.error }, { status: 400 })
  }

  let role: 'asker' | 'expert' = 'asker'
  let expertId: string | undefined

  if (request.headers.get('authorization')) {
    const user = await requireUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }
    role = 'expert'
    expertId = user.id
  }

  const limited = await enforceRateLimit(
    request,
    role === 'expert'
      ? [{ name: 'follow-up-expert-action', subject: expertId, limit: 60, windowSeconds: 3600 }]
      : [{ name: 'follow-up-report-asker', limit: 20, windowSeconds: 3600 }]
  )
  if (limited) return limited

  let query = supabaseAdmin
    .from('follow_up_calls')
    .select('id, status, confirmed_start')
    .eq('id', body.id)
  if (expertId) query = query.eq('expert_id', expertId)
  const { data: call } = await query.maybeSingle()

  if (!call || call.status !== 'confirmed' || !call.confirmed_start) {
    return NextResponse.json(
      { error: 'A problem can’t be reported for this conversation.' },
      { status: 409 }
    )
  }
  if (Date.now() < new Date(call.confirmed_start).getTime()) {
    return NextResponse.json(
      {
        error:
          'This conversation hasn’t started yet. To change plans, cancel it instead.',
      },
      { status: 409 }
    )
  }

  const result = await settleFollowUp({
    id: call.id,
    from: ['confirmed'],
    outcome: 'disputed',
    reason: `${role}_reported_problem`,
    reportedBy: role,
    expertId,
    actor: role,
    problem: { reason: report.reason, note: report.note },
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: 'This conversation has already been updated. Please refresh.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true })
}
