import { resend } from './resend'
import { renderEmailLayout, renderEmailButton, EMAIL_BASE_URL } from './email-layout'
import { logError } from './log-error'
import { send } from './send-follow-up-emails'
import {
  FOLLOW_UP_PLATFORM_FEE_RATE,
  FOLLOW_UP_STRIKE_LIMIT,
  FOLLOW_UP_STRIKE_WINDOW_DAYS,
  escapeHtml,
  formatPrice,
  formatSlot,
  reminderTimesFor,
  type FollowUpOutcome,
} from './follow-up'

const FROM = 'Drop Me A Question <hello@dropmeaquestion.com>'
const SUPPORT_EMAIL = 'hello@dropmeaquestion.com'

function money(cents: number): string {
  return `$${formatPrice(cents)}`
}

// Schedules reminder emails (24 hours and 1 hour before the start) with the
// email provider and returns their ids, so they can be cancelled if the call
// is. Any that can't be scheduled are simply skipped.
export async function scheduleFollowUpReminders({
  askerEmail,
  expertEmail,
  expertFirstName,
  followUpId,
  confirmedStart,
  askerTimezone,
}: {
  askerEmail: string
  expertEmail: string | null
  expertFirstName: string
  followUpId: string
  confirmedStart: string
  askerTimezone: string | null
}): Promise<string[]> {
  const ids: string[] = []
  const name = escapeHtml(expertFirstName)
  const when = escapeHtml(formatSlot(confirmedStart, askerTimezone))

  for (const reminder of reminderTimesFor(confirmedStart)) {
    const lead = reminder.kind === '24h' ? 'tomorrow' : 'in about an hour'
    const jobs: { to: string; subject: string; body: string }[] = [
      {
        to: askerEmail,
        subject: `Reminder: your conversation with ${expertFirstName} is ${lead}`,
        body: `
          <p style="margin:0 0 12px;">A reminder that your 15-minute conversation with ${name} is ${lead}:</p>
          <p style="margin:0 0 20px; font-size:17px; font-weight:bold;">${when}</p>
          <p style="margin:0 0 20px; font-size:13px; color:#4a5568;">The join button on your private page opens 10 minutes before the start.</p>
          ${renderEmailButton(`${EMAIL_BASE_URL}/meet/${followUpId}`, 'Open your join page &rarr;')}
        `,
      },
    ]
    if (expertEmail) {
      jobs.push({
        to: expertEmail,
        subject: `Reminder: your conversation is ${lead}`,
        body: `
          <p style="margin:0 0 12px;">A reminder that you have a 15-minute conversation ${lead}:</p>
          <p style="margin:0 0 20px; font-size:17px; font-weight:bold;">${when}</p>
          <p style="margin:0 0 20px; font-size:13px; color:#4a5568;">Join from your dashboard from 10 minutes before the start, so we can record that you were there.</p>
          ${renderEmailButton(`${EMAIL_BASE_URL}/dashboard/conversations`, 'Open your conversations &rarr;')}
        `,
      })
    }

    for (const job of jobs) {
      try {
        const { data, error } = await resend.emails.send({
          from: FROM,
          to: job.to,
          subject: job.subject,
          html: renderEmailLayout(job.body),
          scheduledAt: reminder.at,
        })
        if (error) await logError('follow-up-reminders:schedule', error, { followUpId })
        else if (data?.id) ids.push(data.id)
      } catch (err) {
        await logError('follow-up-reminders:schedule', err, { followUpId })
      }
    }
  }
  return ids
}

export async function cancelScheduledEmails(ids: unknown) {
  if (!Array.isArray(ids)) return
  for (const id of ids) {
    if (typeof id !== 'string') continue
    try {
      await resend.emails.cancel(id)
    } catch {
      // Already sent or cancelled -- nothing to undo.
    }
  }
}

type Mail = { subject: string; body: string }

// One email per side, worded by how the conversation ended. Amounts are what
// the asker paid and what the expert receives after the 15% fee.
export async function sendFollowUpOutcomeEmails({
  outcome,
  askerEmail,
  expertEmail,
  expertFirstName,
  questionId,
  referenceId,
  priceCents,
  strikes,
}: {
  outcome: FollowUpOutcome
  askerEmail: string | null
  expertEmail: string | null
  expertFirstName: string
  questionId: string
  referenceId: string | null
  priceCents: number
  strikes: number
}) {
  const name = escapeHtml(expertFirstName)
  const paid = money(priceCents)
  const net = money(Math.round(priceCents * (1 - FOLLOW_UP_PLATFORM_FEE_RATE)))
  const ref = referenceId ? ` (Question #${escapeHtml(referenceId)})` : ''
  const rebook = renderEmailButton(
    `${EMAIL_BASE_URL}/follow-up/${questionId}`,
    'Book another time &rarr;'
  )
  const strikeLine = `<p style="margin:12px 0 0; font-size:13px; color:#4a5568;">This counts as ${strikes} of ${FOLLOW_UP_STRIKE_LIMIT} strikes in the last ${FOLLOW_UP_STRIKE_WINDOW_DAYS} days. At ${FOLLOW_UP_STRIKE_LIMIT}, follow-up conversations are switched off for your account.</p>`
  const notCharged = `Your card was <strong>not charged</strong> &mdash; the hold has been released.`

  let asker: Mail | null = null
  let expert: Mail | null = null

  switch (outcome) {
    case 'completed':
      asker = {
        subject: `Your conversation with ${expertFirstName}`,
        body: `<p style="margin:0;">Thanks for talking with ${name}${ref}. Your card was charged ${paid} for the 15-minute conversation.</p>`,
      }
      expert = {
        subject: 'Conversation completed',
        body: `<p style="margin:0;">Your conversation${ref} is complete. ${net} (after DMQ&rsquo;s 15% fee) is on its way to your Stripe balance.</p>`,
      }
      break
    case 'late_cancelled':
      asker = {
        subject: 'Your conversation was cancelled',
        body: `<p style="margin:0;">You cancelled less than 24 hours before the start, so your card was charged ${paid}, as described in the cancellation policy you agreed to.</p>`,
      }
      expert = {
        subject: 'A conversation was cancelled late',
        body: `<p style="margin:0;">The asker cancelled less than 24 hours before the start${ref}. As per the policy, you&rsquo;ll still be paid ${net}.</p>`,
      }
      break
    case 'asker_no_show':
      asker = {
        subject: 'You missed your conversation',
        body: `<p style="margin:0 0 12px;">We didn&rsquo;t see you join your conversation with ${name}, so your card was charged ${paid}, as described in the cancellation policy you agreed to.</p><p style="margin:0; font-size:13px; color:#4a5568;">If something went wrong on our side, just reply to this email.</p>`,
      }
      expert = {
        subject: 'The asker didn’t join',
        body: `<p style="margin:0;">The asker didn&rsquo;t join${ref}. As per the policy, you&rsquo;ll be paid ${net}.</p>`,
      }
      break
    case 'cancelled_by_asker':
      asker = {
        subject: 'Your conversation was cancelled',
        body: `<p style="margin:0;">Your conversation with ${name} is cancelled. ${notCharged}</p>`,
      }
      expert = {
        subject: 'A conversation was cancelled',
        body: `<p style="margin:0;">The asker cancelled more than 24 hours ahead${ref}, so that time is free again. No payment was taken.</p>`,
      }
      break
    case 'cancelled_by_expert':
      asker = {
        subject: `${expertFirstName} had to cancel`,
        body: `<p style="margin:0 0 12px;">We&rsquo;re sorry &mdash; ${name} had to cancel your conversation. ${notCharged}</p>${rebook}`,
      }
      expert = {
        subject: 'You cancelled a conversation',
        body: `<p style="margin:0;">You cancelled the conversation${ref}. The asker wasn&rsquo;t charged.</p>${strikeLine}`,
      }
      break
    case 'expert_no_show':
    case 'admin_release_expert_fault':
      asker = {
        subject: `${expertFirstName} couldn’t make it`,
        body: `<p style="margin:0 0 12px;">We&rsquo;re sorry &mdash; ${name} didn&rsquo;t make your conversation. ${notCharged}</p>${rebook}`,
      }
      expert = {
        subject: 'You missed a conversation',
        body: `<p style="margin:0;">You didn&rsquo;t join the conversation${ref}, so the asker wasn&rsquo;t charged.</p>${strikeLine}`,
      }
      break
    case 'neither_joined':
      asker = {
        subject: 'Your conversation didn’t take place',
        body: `<p style="margin:0 0 12px;">We didn&rsquo;t see anyone open the join page for your conversation with ${name}. ${notCharged}</p>${rebook}`,
      }
      expert = {
        subject: 'A conversation didn’t take place',
        body: `<p style="margin:0;">Neither of you opened the join page${ref}, so no payment was taken. If you did meet, please contact us at ${SUPPORT_EMAIL}.</p>`,
      }
      break
    case 'admin_release':
      asker = {
        subject: 'Your conversation was reviewed',
        body: `<p style="margin:0;">We reviewed your conversation with ${name}. ${notCharged}</p>`,
      }
      expert = {
        subject: 'A conversation was reviewed',
        body: `<p style="margin:0;">We reviewed the conversation${ref} and released the hold, so no payment was taken. Contact ${SUPPORT_EMAIL} with any questions.</p>`,
      }
      break
    case 'disputed':
      asker = {
        subject: 'We’re looking into your conversation',
        body: `<p style="margin:0;">Thanks for letting us know. We&rsquo;re reviewing your conversation with ${name}. Your card won&rsquo;t be charged unless we find it took place, and the hold is released if we can&rsquo;t settle it in time.</p>`,
      }
      expert = {
        subject: 'A conversation is under review',
        body: `<p style="margin:0;">A problem was reported with your conversation${ref}. We&rsquo;re reviewing it and will be in touch. Contact ${SUPPORT_EMAIL} if you have details to add.</p>`,
      }
      break
  }

  if (askerEmail && asker) {
    await send(askerEmail, asker.subject, asker.body, `follow-up-outcome:${outcome}:asker`)
  }
  if (expertEmail && expert) {
    await send(expertEmail, expert.subject, expert.body, `follow-up-outcome:${outcome}:expert`)
  }
}

// Tells the support inbox a conversation needs a decision.
export async function sendFollowUpDisputeAlert({
  referenceId,
  reportedBy,
  priceCents,
  askerJoined,
  expertJoined,
  captureBefore,
}: {
  referenceId: string | null
  reportedBy: string
  priceCents: number
  askerJoined: boolean
  expertJoined: boolean
  captureBefore: string | null
}) {
  const body = `
    <p style="margin:0 0 12px;"><strong>A follow-up conversation needs a decision.</strong></p>
    <ul style="margin:0 0 16px; padding-left:20px;">
      <li>Question: ${referenceId ? `#${escapeHtml(referenceId)}` : 'n/a'}</li>
      <li>Reported by: ${escapeHtml(reportedBy)}</li>
      <li>Amount held: ${money(priceCents)}</li>
      <li>Asker opened the join page: ${askerJoined ? 'yes' : 'no'}</li>
      <li>Expert opened the join page: ${expertJoined ? 'yes' : 'no'}</li>
      <li>Hold lapses: ${captureBefore ? escapeHtml(new Date(captureBefore).toUTCString()) : 'unknown'} (released automatically about 12 hours before)</li>
    </ul>
    ${renderEmailButton(`${EMAIL_BASE_URL}/admin/conversations`, 'Review in admin &rarr;')}
  `
  await send(
    SUPPORT_EMAIL,
    `Conversation needs review${referenceId ? ` — #${referenceId}` : ''}`,
    body,
    'follow-up-outcome:dispute-alert'
  )
}
