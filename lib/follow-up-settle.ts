import { supabaseAdmin } from './supabase-admin'
import { logError } from './log-error'
import { captureFollowUpHold } from './follow-up-capture'
import { releaseFollowUpHold } from './follow-up-release'
import {
  cancelScheduledEmails,
  sendFollowUpDisputeAlert,
  sendFollowUpOutcomeEmails,
} from './send-follow-up-outcome-emails'
import { logFollowUpEvent, type FollowUpActor } from './follow-up-events'
import {
  problemReasonLabel,
  type FollowUpOutcome,
  type FollowUpProblemReason,
} from './follow-up-rules'

type OutcomeSpec = {
  status: string
  cancelledBy: 'asker' | 'expert' | null
  money: 'capture' | 'release' | 'hold'
}

// How each ending is recorded and what happens to the asker's card hold.
const OUTCOMES: Record<FollowUpOutcome, OutcomeSpec> = {
  completed: { status: 'completed', cancelledBy: null, money: 'capture' },
  late_cancelled: { status: 'late_cancelled', cancelledBy: 'asker', money: 'capture' },
  asker_no_show: { status: 'asker_no_show', cancelledBy: null, money: 'capture' },
  cancelled_by_asker: { status: 'cancelled', cancelledBy: 'asker', money: 'release' },
  cancelled_by_expert: { status: 'cancelled', cancelledBy: 'expert', money: 'release' },
  expert_no_show: { status: 'expert_no_show', cancelledBy: null, money: 'release' },
  neither_joined: { status: 'expired', cancelledBy: null, money: 'release' },
  admin_release: { status: 'cancelled', cancelledBy: null, money: 'release' },
  admin_release_expert_fault: { status: 'expert_no_show', cancelledBy: null, money: 'release' },
  disputed: { status: 'disputed', cancelledBy: null, money: 'hold' },
}

export async function settleFollowUp({
  id,
  from,
  outcome,
  reason,
  reportedBy,
  expertId,
  actor = 'system',
  problem,
  rescheduling = false,
  detail,
  systemNote,
}: {
  id: string
  // Only moves a booking that is currently in one of these states, so two
  // things happening at once (a cancel and the daily job, say) can't both win.
  from: string[]
  outcome: FollowUpOutcome
  reason: string
  // For "disputed": who raised it (null when the system flagged it).
  reportedBy?: 'asker' | 'expert' | null
  // Restricts the move to one expert's own booking.
  expertId?: string
  // Who caused this, for the evidence timeline.
  actor?: FollowUpActor
  // For "disputed": what the reporter said went wrong.
  problem?: { reason: FollowUpProblemReason; note: string | null }
  // The asker cancelled in order to pick new times (changes the emails).
  rescheduling?: boolean
  // Extra facts for the evidence timeline (for example connection times).
  detail?: Record<string, unknown>
  // For a booking the system itself held for review: why, in words, for the
  // alert to support.
  systemNote?: string
}): Promise<{ ok: true } | { ok: false }> {
  const spec = OUTCOMES[outcome]
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = {
    status: spec.status,
    settlement_reason: reason,
  }
  if (spec.cancelledBy) patch.cancelled_by = spec.cancelledBy
  if (spec.status === 'completed') patch.completed_at = now
  if (spec.status === 'cancelled' || spec.status === 'late_cancelled') patch.cancelled_at = now
  if (outcome === 'disputed') {
    patch.problem_reported_at = now
    patch.problem_reported_by = reportedBy ?? null
    if (problem) {
      patch.problem_reason = problem.reason
      patch.problem_note = problem.note
    }
  }

  let query = supabaseAdmin.from('follow_up_calls').update(patch).eq('id', id).in('status', from)
  if (expertId) query = query.eq('expert_id', expertId)

  const { data: moved, error } = await query.select(
    'id, question_id, expert_id, stripe_payment_intent_id, price_cents, reminder_email_ids, asker_joined_at, expert_joined_at, capture_before'
  )
  if (error) {
    await logError('follow-up-settle', error, { followUpId: id, outcome })
    return { ok: false }
  }
  if (!moved || moved.length === 0) return { ok: false }
  const call = moved[0]

  await logFollowUpEvent(call.id, outcome === 'disputed' ? 'problem_reported' : 'settled', actor, {
    outcome,
    reason,
    money: spec.money,
    ...(detail ?? {}),
    ...(problem ? { problem_reason: problem.reason, problem_note: problem.note } : {}),
  })

  // Money first. If it fails, the daily job retries (captured_at /
  // released_at are only set once Stripe confirms).
  if (spec.money === 'capture') {
    await captureFollowUpHold(call.id, call.stripe_payment_intent_id)
  } else if (spec.money === 'release') {
    await releaseFollowUpHold(call.id, call.stripe_payment_intent_id)
  }

  await cancelScheduledEmails(call.reminder_email_ids)

  // Isolated so a failed email can never undo the settlement.
  try {
    const [{ data: question }, { data: profile }, { data: expertRow }] = await Promise.all([
      supabaseAdmin
        .from('questions')
        .select('asker_email, reference_id')
        .eq('id', call.question_id)
        .maybeSingle(),
      supabaseAdmin.from('profiles').select('full_name').eq('id', call.expert_id).maybeSingle(),
      supabaseAdmin
        .from('experts')
        .select('email_notifications')
        .eq('id', call.expert_id)
        .maybeSingle(),
    ])

    let expertEmail: string | null = null
    if (expertRow?.email_notifications !== false) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(call.expert_id)
      expertEmail = authUser?.user?.email ?? null
    }

    await sendFollowUpOutcomeEmails({
      outcome,
      askerEmail: question?.asker_email ?? null,
      expertEmail,
      expertFirstName: profile?.full_name?.split(' ')[0] || 'Your expert',
      questionId: call.question_id,
      referenceId: question?.reference_id ?? null,
      priceCents: call.price_cents,
      rescheduling,
    })

    if (outcome === 'disputed') {
      await sendFollowUpDisputeAlert({
        referenceId: question?.reference_id ?? null,
        reportedBy: reportedBy ?? systemNote ?? 'the system (only the asker opened the join page)',
        problemReason: problem ? problemReasonLabel(problem.reason, reportedBy ?? null) : null,
        problemNote: problem?.note ?? null,
        priceCents: call.price_cents,
        askerJoined: Boolean(call.asker_joined_at),
        expertJoined: Boolean(call.expert_joined_at),
        captureBefore: call.capture_before,
      })
    }
  } catch (notifyErr) {
    await logError('follow-up-settle:notification', notifyErr, { followUpId: id, outcome })
  }

  return { ok: true }
}
