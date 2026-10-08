import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { logError } from '@/lib/log-error'
import { settleFollowUp } from '@/lib/follow-up-settle'
import type { FollowUpOutcome } from '@/lib/follow-up'

const RESOLUTIONS: Record<string, { outcome: FollowUpOutcome; reason: string }> = {
  // The conversation took place: charge the asker, pay the expert.
  capture: { outcome: 'completed', reason: 'admin_capture' },
  // It didn't, and nobody's to blame: release the hold.
  release: { outcome: 'admin_release', reason: 'admin_release' },
  // It didn't because the expert didn't show: release the hold and record it.
  release_expert_fault: {
    outcome: 'admin_release_expert_fault',
    reason: 'admin_release_expert_fault',
  },
}

// An admin decides a conversation that was held for review.
export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  let body: { id?: unknown; resolution?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.id !== 'string' || typeof body.resolution !== 'string') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const resolution = RESOLUTIONS[body.resolution]
  if (!resolution) {
    return NextResponse.json({ error: 'Unknown resolution.' }, { status: 400 })
  }

  const result = await settleFollowUp({
    id: body.id,
    from: ['disputed'],
    outcome: resolution.outcome,
    reason: `${resolution.reason}:${admin.email ?? 'admin'}`,
  })
  if (!result.ok) {
    await logError('admin/follow-up-resolve', new Error('Not resolvable'), {
      followUpId: body.id,
      adminEmail: admin.email,
    })
    return NextResponse.json(
      { error: 'This conversation is no longer awaiting a decision.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true })
}
