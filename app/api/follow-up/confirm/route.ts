import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'
import { isAllowedMeetingLink } from '@/lib/follow-up'
import { videoMode } from '@/lib/video/config'
import { logFollowUpEvent, meetingLinkHost } from '@/lib/follow-up-events'
import { sendFollowUpConfirmedEmails } from '@/lib/send-follow-up-emails'
import {
  cancelScheduledEmails,
  scheduleFollowUpReminders,
} from '@/lib/send-follow-up-outcome-emails'

const MIN_LEAD_MINUTES = 120

// The expert accepts one of the proposed times and adds a meeting link for
// this call. Only the expert it was requested of can do this, and only while
// the request is still waiting.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-expert-action', subject: user.id, limit: 60, windowSeconds: 3600 },
  ])
  if (limited) return limited

  let body: { id?: unknown; slot?: unknown; meetingLink?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.id !== 'string' || typeof body.slot !== 'string') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // With DMQ rooms on, every confirmed conversation is held on DMQ: choosing a
  // time is enough, and a link sent along is ignored. There is no own-link
  // choice; a call that isn't working is rescheduled for free instead (see
  // reschedule-live). With DMQ rooms off, a link is required, as before.
  const useDmq = videoMode() === 'dmq'
  const link = useDmq ? null : isAllowedMeetingLink(body.meetingLink)
  if (link && !link.ok) {
    return NextResponse.json({ error: link.error }, { status: 400 })
  }
  const meetingUrl = link && link.ok ? link.url : null

  const { data: call } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, question_id, status, proposed_slots, asker_timezone, price_cents')
    .eq('id', body.id)
    .eq('expert_id', user.id)
    .maybeSingle()
  if (!call) {
    return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  }
  if (call.status !== 'requested') {
    return NextResponse.json(
      { error: 'This request has already been handled or has expired.' },
      { status: 409 }
    )
  }

  const chosenMs = new Date(body.slot).getTime()
  const proposed = Array.isArray(call.proposed_slots) ? (call.proposed_slots as string[]) : []
  const chosen = proposed.find((s) => new Date(s).getTime() === chosenMs)
  if (!chosen || Number.isNaN(chosenMs)) {
    return NextResponse.json({ error: 'Choose one of the proposed times.' }, { status: 400 })
  }
  if (chosenMs < Date.now() + MIN_LEAD_MINUTES * 60 * 1000) {
    return NextResponse.json(
      { error: 'That time is too soon to confirm. Please decline and ask for new times.' },
      { status: 400 }
    )
  }

  // The status guard means a request that expired or was handled a moment ago
  // can't be confirmed on top of that.
  const { data: confirmed, error } = await supabaseAdmin
    .from('follow_up_calls')
    .update({
      status: 'confirmed',
      confirmed_start: new Date(chosenMs).toISOString(),
      meeting_link: meetingUrl,
      // Only written when DMQ rooms are on, so nothing depends on the new
      // column until then.
      ...(useDmq ? { video_provider: 'dmq' } : {}),
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', call.id)
    .eq('expert_id', user.id)
    .eq('status', 'requested')
    .select('id')

  if (error) {
    await logError('follow-up/confirm', error, { followUpId: call.id })
    return NextResponse.json({ error: 'Could not confirm. Please try again.' }, { status: 500 })
  }
  if (!confirmed || confirmed.length === 0) {
    return NextResponse.json(
      { error: 'This request has already been handled or has expired.' },
      { status: 409 }
    )
  }

  await logFollowUpEvent(call.id, 'confirmed', 'expert', {
    confirmed_start: new Date(chosenMs).toISOString(),
    meeting_service: useDmq ? 'dmq' : meetingLinkHost(meetingUrl),
  })

  // Isolated: a failed email must never undo the confirmation.
  try {
    const [{ data: question }, { data: profile }, { data: expertRow }] = await Promise.all([
      supabaseAdmin
        .from('questions')
        .select('asker_email, reference_id')
        .eq('id', call.question_id)
        .maybeSingle(),
      supabaseAdmin.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      supabaseAdmin.from('experts').select('email_notifications').eq('id', user.id).maybeSingle(),
    ])

    if (question?.asker_email) {
      const expertEmail = expertRow?.email_notifications === false ? null : (user.email ?? null)
      const expertFirstName = profile?.full_name?.split(' ')[0] || 'Your expert'
      const confirmedStart = new Date(chosenMs).toISOString()

      await sendFollowUpConfirmedEmails({
        askerEmail: question.asker_email,
        expertEmail,
        expertFirstName,
        followUpId: call.id,
        referenceId: question.reference_id,
        confirmedStart,
        askerTimezone: call.asker_timezone,
        videoProvider: useDmq ? 'dmq' : 'external',
      })

      // Reminders 24 hours and 1 hour ahead. Their ids are kept so a
      // cancellation can call them off; if the ids can't be saved the
      // reminders are cancelled again rather than left to go out on their own.
      const reminderIds = await scheduleFollowUpReminders({
        askerEmail: question.asker_email,
        expertEmail,
        expertFirstName,
        followUpId: call.id,
        confirmedStart,
        askerTimezone: call.asker_timezone,
        priceCents: call.price_cents,
      })
      await logFollowUpEvent(call.id, 'emails_scheduled', 'system', {
        reminders_and_review: reminderIds.length,
      })
      if (reminderIds.length > 0) {
        const { error: saveError } = await supabaseAdmin
          .from('follow_up_calls')
          .update({ reminder_email_ids: reminderIds })
          .eq('id', call.id)
        if (saveError) {
          await cancelScheduledEmails(reminderIds)
          await logError('follow-up/confirm:save-reminders', saveError, { followUpId: call.id })
        }
      }
    }
  } catch (notifyErr) {
    await logError('follow-up/confirm:notification', notifyErr, { followUpId: call.id })
  }

  return NextResponse.json({ ok: true })
}
