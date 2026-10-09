import { resend } from './resend'
import { renderEmailLayout, renderEmailButton, EMAIL_BASE_URL } from './email-layout'
import { logError } from './log-error'
import { videoMode } from './video/config'
import {
  followUpPolicyLines,
  followUpPrivacyLines,
  FOLLOW_UP_PLATFORM_FEE_RATE,
  escapeHtml,
  formatPrice,
  formatSlot,
} from './follow-up'

const FROM = 'Drop Me A Question <hello@dropmeaquestion.com>'

export async function send(to: string, subject: string, body: string, source: string) {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html: renderEmailLayout(body),
    })
    if (error) await logError(`${source}:resend`, error, { to })
  } catch (err) {
    await logError(source, err, { to })
  }
}

function listItems(lines: string[]): string {
  return lines
    .map((line) => `<li style="margin:0 0 6px;">${escapeHtml(line)}</li>`)
    .join('')
}

// Sent once the asker's card hold is in place: tells the expert there's a
// request to confirm, and the asker that it's with the expert.
export async function sendFollowUpRequestedEmails({
  expertEmail,
  expertFirstName,
  askerEmail,
  referenceId,
  slots,
  askerTimezone,
  priceCents,
}: {
  expertEmail: string | null
  expertFirstName: string
  askerEmail: string
  referenceId: string | null
  slots: string[]
  askerTimezone: string | null
  priceCents: number
}) {
  const name = escapeHtml(expertFirstName)
  const ref = referenceId ? ` for Question #${escapeHtml(referenceId)}` : ''
  const times = slots
    .map(
      (slot) =>
        `<li style="margin:0 0 6px;">${escapeHtml(formatSlot(slot, askerTimezone))}</li>`
    )
    .join('')
  const net = formatPrice(Math.round(priceCents * (1 - FOLLOW_UP_PLATFORM_FEE_RATE)))

  if (expertEmail) {
    const body = `
      <p style="margin:0 0 16px;">Hi ${name}, the person who asked${ref} would like a 15-minute conversation with you &mdash; worth $${net} to you.</p>
      <p style="margin:0 0 8px;">They proposed these times${askerTimezone ? ` (shown in their time zone, ${escapeHtml(askerTimezone)})` : ''}:</p>
      <ul style="margin:0 0 16px; padding-left:20px;">${times}</ul>
      <p style="margin:0 0 24px; font-size:13px; color:#4a5568;">Confirm one of them within 24 hours${videoMode() === 'dmq' ? ' (the conversation takes place on DMQ, or you can add your own Zoom or Google Meet link instead)' : ', adding your own Zoom or Google Meet link for this call'}, or decline. If you don&rsquo;t respond the request expires and they aren&rsquo;t charged. Their email address stays private.</p>
      ${renderEmailButton(`${EMAIL_BASE_URL}/dashboard/conversations`, 'Review the request &rarr;')}
    `
    await send(
      expertEmail,
      'New follow-up conversation request',
      body,
      'send-follow-up-emails:expert-requested'
    )
  }

  const askerBody = `
    <p style="margin:0 0 16px;">Your request for a 15-minute conversation with ${name} has been sent.</p>
    <p style="margin:0 0 8px;">The times you proposed:</p>
    <ul style="margin:0 0 16px; padding-left:20px;">${times}</ul>
    <p style="margin:0 0 8px;">${name} has 24 hours to confirm one. You&rsquo;ll get an email as soon as they do. Your card is held, not charged.</p>
    <p style="margin:16px 0 4px; font-size:13px; font-weight:bold; color:#17243a;">How it works</p>
    <ul style="margin:0 0 16px; padding-left:20px; font-size:13px; color:#4a5568;">${listItems(followUpPolicyLines(videoMode()))}</ul>
    <ul style="margin:0; padding-left:20px; font-size:13px; color:#4a5568;">${listItems(followUpPrivacyLines(videoMode()))}</ul>
  `
  await send(
    askerEmail,
    `Your conversation request to ${expertFirstName} was sent`,
    askerBody,
    'send-follow-up-emails:asker-requested'
  )
}

// The hold was released and the asker wasn't charged. They can try again.
export async function sendFollowUpReleasedEmail({
  askerEmail,
  expertFirstName,
  questionId,
  reason,
}: {
  askerEmail: string
  expertFirstName: string
  questionId: string
  reason: 'times_unusable' | 'expired' | 'declined'
}) {
  const name = escapeHtml(expertFirstName)
  const lead =
    reason === 'times_unusable'
      ? `We couldn&rsquo;t hold your card long enough for the times you proposed.`
      : reason === 'declined'
        ? `${name} couldn&rsquo;t make any of the times you proposed.`
        : `${name} didn&rsquo;t confirm a time within 24 hours, so the request expired.`

  const body = `
    <p style="margin:0 0 16px;">${lead}</p>
    <p style="margin:0 0 24px;">Your card was <strong>not charged</strong> &mdash; the hold has been released. If you&rsquo;d still like to talk it through, you can propose new times.</p>
    ${renderEmailButton(`${EMAIL_BASE_URL}/follow-up/${questionId}`, 'Propose new times &rarr;')}
  `
  await send(
    askerEmail,
    'Your conversation request wasn’t booked',
    body,
    'send-follow-up-emails:released'
  )
}

// Sent when the expert confirms a time. The asker gets a private join page (the
// meeting link itself is only revealed there, shortly before the start); the
// expert gets a record. Times use the asker's time zone, the only one on file.
export async function sendFollowUpConfirmedEmails({
  askerEmail,
  expertEmail,
  expertFirstName,
  followUpId,
  referenceId,
  confirmedStart,
  askerTimezone,
  videoProvider = 'external',
}: {
  askerEmail: string
  expertEmail: string | null
  expertFirstName: string
  followUpId: string
  referenceId: string | null
  confirmedStart: string
  askerTimezone: string | null
  videoProvider?: 'dmq' | 'external'
}) {
  const name = escapeHtml(expertFirstName)
  const when = escapeHtml(formatSlot(confirmedStart, askerTimezone))
  const joinUrl = `${EMAIL_BASE_URL}/meet/${followUpId}`

  const askerBody = `
    <p style="margin:0 0 16px;">${name} confirmed your 15-minute conversation.</p>
    <p style="margin:0 0 4px; font-size:13px; color:#4a5568;">When</p>
    <p style="margin:0 0 20px; font-size:17px; font-weight:bold;">${when}</p>
    <p style="margin:0 0 20px;">Your private join page opens 10 minutes before the start. Use the button below at that time &mdash; keep this email handy.</p>
    ${videoProvider === 'dmq' ? '<p style="margin:0 0 20px; font-size:13px; color:#4a5568;">The conversation takes place right there on Drop Me A Question, as an audio call. Your camera stays off unless you turn it on, and you appear as &ldquo;Guest&rdquo;.</p>' : videoMode() === 'dmq' ? '<p style="margin:0 0 20px; font-size:13px; color:#4a5568;">This conversation uses the expert&rsquo;s own meeting link, which your join page opens at the start.</p>' : ''}
    ${renderEmailButton(joinUrl, 'Open your join page &rarr;')}
    <p style="margin:24px 0 8px; font-size:13px; font-weight:bold; color:#17243a;">Good to know</p>
    <ul style="margin:0 0 12px; padding-left:20px; font-size:13px; color:#4a5568;">${listItems(followUpPolicyLines(videoMode()))}</ul>
    <ul style="margin:0; padding-left:20px; font-size:13px; color:#4a5568;">${listItems(followUpPrivacyLines(videoMode()))}</ul>
  `
  await send(
    askerEmail,
    `Your conversation with ${expertFirstName} is confirmed`,
    askerBody,
    'send-follow-up-emails:asker-confirmed'
  )

  if (expertEmail) {
    const ref = referenceId ? ` for Question #${escapeHtml(referenceId)}` : ''
    const expertBody = `
      <p style="margin:0 0 16px;">Your 15-minute conversation${ref} is confirmed.</p>
      <p style="margin:0 0 4px; font-size:13px; color:#4a5568;">When${askerTimezone ? ` (the asker&rsquo;s time zone, ${escapeHtml(askerTimezone)})` : ''}</p>
      <p style="margin:0 0 20px; font-size:17px; font-weight:bold;">${when}</p>
      <p style="margin:0 0 20px; font-size:13px; color:#4a5568;">${videoProvider === 'dmq' ? 'Join from your Conversations page from 10 minutes before the start. The conversation takes place on DMQ as an audio call, and your camera stays off until you turn it on.' : 'Join from your dashboard from 10 minutes before the start.'} The asker can&rsquo;t see your email address, and you can&rsquo;t see theirs.</p>
      ${renderEmailButton(`${EMAIL_BASE_URL}/dashboard/conversations`, 'Open your conversations &rarr;')}
    `
    await send(
      expertEmail,
      'Your conversation is confirmed',
      expertBody,
      'send-follow-up-emails:expert-confirmed'
    )
  }
}

// The expert moved a conversation held on DMQ to their own meeting link, for
// example because the call wasn't working. The asker's join page now opens
// that link, so tell them right away.
export async function sendFollowUpMovedToOwnLinkEmail({
  askerEmail,
  expertFirstName,
  followUpId,
  confirmedStart,
  askerTimezone,
}: {
  askerEmail: string
  expertFirstName: string
  followUpId: string
  confirmedStart: string
  askerTimezone: string | null
}) {
  const name = escapeHtml(expertFirstName)
  const when = escapeHtml(formatSlot(confirmedStart, askerTimezone))
  const body = `
    <p style="margin:0 0 16px;">${name} has moved your conversation to their own video meeting link. Nothing else changes &mdash; same time, same price.</p>
    <p style="margin:0 0 4px; font-size:13px; color:#4a5568;">When</p>
    <p style="margin:0 0 20px; font-size:17px; font-weight:bold;">${when}</p>
    <p style="margin:0 0 20px;">Use your private join page, as before. It now opens ${name}&rsquo;s meeting link, and your meeting profile&rsquo;s display name may be visible there.</p>
    ${renderEmailButton(`${EMAIL_BASE_URL}/meet/${followUpId}`, 'Open your join page &rarr;')}
  `
  await send(
    askerEmail,
    `${expertFirstName} moved your conversation to their own link`,
    body,
    'send-follow-up-emails:moved-to-own-link'
  )
}
