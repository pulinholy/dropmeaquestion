import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'
import { isAllowedMeetingLink, videoRoomWindowFor } from '@/lib/follow-up'
import { logFollowUpEvent, meetingLinkHost } from '@/lib/follow-up-events'
import { sendFollowUpMovedToOwnLinkEmail } from '@/lib/send-follow-up-emails'
import { videoMode } from '@/lib/video/config'

// The escape hatch for a conversation held on DMQ: if the call won't work
// (the provider is down, someone's browser can't cope), the expert moves it to
// their own meeting link. The asker is told straight away and their join page
// then opens that link. From then on the booking settles like any other
// external-link booking. Only possible until the room closes.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-expert-action', subject: user.id, limit: 60, windowSeconds: 3600 },
  ])
  if (limited) return limited

  let body: { id?: unknown; meetingLink?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const link = isAllowedMeetingLink(body.meetingLink)
  if (!link.ok) {
    return NextResponse.json({ error: link.error }, { status: 400 })
  }

  // Only relevant once DMQ rooms have been switched on.
  if (videoMode() !== 'dmq') {
    return NextResponse.json({ error: 'This conversation can’t be changed.' }, { status: 409 })
  }

  const { data: call } = await supabaseAdmin
    .from('follow_up_calls')
    .select('id, question_id, status, video_provider, confirmed_start, asker_timezone')
    .eq('id', body.id)
    .eq('expert_id', user.id)
    .maybeSingle()

  if (
    !call ||
    call.status !== 'confirmed' ||
    call.video_provider !== 'dmq' ||
    !call.confirmed_start
  ) {
    return NextResponse.json({ error: 'This conversation can’t be changed.' }, { status: 409 })
  }
  if (Date.now() > videoRoomWindowFor(call.confirmed_start).closesAt.getTime()) {
    return NextResponse.json(
      { error: 'This conversation has ended, so the link can’t be changed.' },
      { status: 409 }
    )
  }

  // The status and provider guards mean two things happening at once (this and
  // a settlement, say) can't both win.
  const { data: moved, error } = await supabaseAdmin
    .from('follow_up_calls')
    .update({ video_provider: 'external', meeting_link: link.url })
    .eq('id', call.id)
    .eq('expert_id', user.id)
    .eq('status', 'confirmed')
    .eq('video_provider', 'dmq')
    .select('id')
  if (error) {
    await logError('follow-up/use-own-link', error, { followUpId: call.id })
    return NextResponse.json({ error: 'Could not change it. Please try again.' }, { status: 500 })
  }
  if (!moved || moved.length === 0) {
    return NextResponse.json(
      { error: 'This conversation has already been updated. Please refresh.' },
      { status: 409 }
    )
  }

  await logFollowUpEvent(call.id, 'moved_to_own_link', 'expert', {
    meeting_service: meetingLinkHost(link.url),
  })

  // Isolated: a failed email must never undo the change.
  try {
    const [{ data: question }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from('questions')
        .select('asker_email')
        .eq('id', call.question_id)
        .maybeSingle(),
      supabaseAdmin.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    ])
    if (question?.asker_email) {
      await sendFollowUpMovedToOwnLinkEmail({
        askerEmail: question.asker_email,
        expertFirstName: profile?.full_name?.split(' ')[0] || 'Your expert',
        followUpId: call.id,
        confirmedStart: call.confirmed_start,
        askerTimezone: call.asker_timezone,
      })
    }
  } catch (notifyErr) {
    await logError('follow-up/use-own-link:notification', notifyErr, { followUpId: call.id })
  }

  return NextResponse.json({ ok: true })
}
