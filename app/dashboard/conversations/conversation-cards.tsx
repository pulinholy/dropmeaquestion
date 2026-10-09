"use client"

import { useState } from "react"
import {
  ALLOWED_MEETING_SERVICES_TEXT,
  FOLLOW_UP_NO_SHOW_AFTER_MINUTES,
  FOLLOW_UP_PLATFORM_FEE_RATE,
  formatPrice,
  joinWindowFor,
  videoRoomWindowFor,
  type FollowUpProblemReason,
} from "@/lib/follow-up-rules"
import ReportProblemForm from "@/components/ReportProblemForm"

export type FollowUpCall = {
  id: string
  status: string
  priceCents: number
  referenceId: string | null
  proposedSlots: string[]
  confirmedStart: string | null
  meetingLink: string | null
  // How the conversation is held: on DMQ or on the expert's own link.
  videoProvider?: "dmq" | "external"
  confirmBy: string | null
  askerTimezone: string | null
  cancelledBy: string | null
  askerJoined: boolean
  expertJoined: boolean
  // What the expert has said about how it went, before it's settled.
  expertMarked: "completed" | "asker_no_show" | null
  createdAt: string
}

// Shown in the expert's own time zone (the browser's).
export function formatLocal(iso: string, withZone = true): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(withZone ? { timeZoneName: "short" } : {}),
  }).format(new Date(iso))
}

function earnings(priceCents: number): string {
  return formatPrice(Math.round(priceCents * (1 - FOLLOW_UP_PLATFORM_FEE_RATE)))
}

export function RequestCard({
  call,
  busy,
  error,
  onConfirm,
  onDecline,
  videoMode,
}: {
  call: FollowUpCall
  busy: boolean
  error: string
  onConfirm: (slot: string, meetingLink: string) => void
  onDecline: () => void
  // "dmq" when conversations are held on DMQ: a link is then optional.
  videoMode?: "dmq" | "external"
}) {
  const [slot, setSlot] = useState(call.proposedSlots[0] ?? "")
  const [link, setLink] = useState("")
  const [ownLink, setOwnLink] = useState(false)
  const onDmq = videoMode === "dmq"

  return (
    <div className="rounded-lg border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {call.referenceId ? `Question #${call.referenceId}` : "Follow-up conversation"}
        </p>
        <p className="text-xs text-ink-soft">
          You&apos;ll receive ${earnings(call.priceCents)} after DMQ&apos;s 15% fee
        </p>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        The asker wants a 15-minute conversation.
        {call.confirmBy && (
          <>
            {" "}
            Please respond by{" "}
            <strong className="text-ink">{formatLocal(call.confirmBy)}</strong>, or the
            request expires and they aren&apos;t charged.
          </>
        )}
      </p>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-ink">
          Choose a time (shown in your time zone)
        </legend>
        <div className="mt-2 space-y-2">
          {call.proposedSlots.map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer items-center gap-2.5 rounded-sm border px-3 py-2 text-sm text-ink ${
                slot === s ? "border-postal-red bg-postal-red/5" : "border-line"
              }`}
            >
              <input
                type="radio"
                name={`slot-${call.id}`}
                value={s}
                checked={slot === s}
                onChange={() => setSlot(s)}
                className="accent-postal-red"
              />
              {formatLocal(s)}
            </label>
          ))}
        </div>
      </fieldset>

      {onDmq && (
        <p className="mt-4 text-xs text-ink-soft">
          The conversation takes place on DMQ, as an audio call with an optional
          camera. There is nothing to paste.{" "}
          <button
            type="button"
            onClick={() => {
              setOwnLink((v) => !v)
              setLink("")
            }}
            className="font-medium text-ink underline underline-offset-2"
          >
            {ownLink ? "Use DMQ instead" : "Use my own meeting link instead"}
          </button>
        </p>
      )}

      {(!onDmq || ownLink) && (
        <>
          <label className="mt-4 block text-xs font-medium text-ink" htmlFor={`link-${call.id}`}>
            Meeting link for this call
          </label>
          <input
            id={`link-${call.id}`}
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://meet.google.com/..."
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60"
          />
          <p className="mt-1 text-xs text-ink-soft">
            {ALLOWED_MEETING_SERVICES_TEXT}. Use a new link for each call, with a
            waiting room turned on, and never your personal reusable room if you can
            avoid it. The asker only sees it shortly before the start.
            {onDmq && " The asker will be told this conversation uses your own link."}
          </p>
        </>
      )}

      {error && <p className="mt-3 text-sm text-postal-red">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !slot || ((!onDmq || ownLink) && link.trim().length === 0)}
          onClick={() => onConfirm(slot, link)}
          className="rounded-full bg-postal-red px-5 py-2 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
        >
          {busy ? "Working..." : "Confirm this time"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Decline all of these times? The asker isn't charged and is invited to propose new times."
              )
            ) {
              onDecline()
            }
          }}
          className="text-sm font-medium text-ink-soft hover:text-ink disabled:opacity-50"
        >
          None of these work
        </button>
      </div>
    </div>
  )
}

export function UpcomingCard({
  call,
  now,
  joining,
  busy,
  error,
  onJoin,
  onCancel,
  onComplete,
  onAskerNoShow,
  onReport,
  onUseOwnLink,
}: {
  call: FollowUpCall
  now: number
  joining: boolean
  busy: boolean
  error: string
  onJoin: () => void
  onCancel: () => void
  onComplete: () => void
  onAskerNoShow: () => void
  onReport: (reason: FollowUpProblemReason, note: string) => void
  onUseOwnLink: (meetingLink: string) => void
}) {
  const [reporting, setReporting] = useState(false)
  const [ownLinkOpen, setOwnLinkOpen] = useState(false)
  const [ownLink, setOwnLink] = useState("")
  if (!call.confirmedStart) return null
  const { opensAt, closesAt } =
    call.videoProvider === "dmq"
      ? videoRoomWindowFor(call.confirmedStart)
      : joinWindowFor(call.confirmedStart)
  const open = now >= opensAt.getTime() && now <= closesAt.getTime()
  const start = new Date(call.confirmedStart).getTime()
  const started = now >= start
  // The asker can only be marked as not having joined once their whole slot
  // has passed, and only if they never opened the join page.
  const noShowAllowed =
    !call.askerJoined && now >= start + FOLLOW_UP_NO_SHOW_AFTER_MINUTES * 60 * 1000

  const linkButton =
    "text-xs font-medium text-ink-soft hover:text-ink disabled:opacity-50"

  return (
    <div className="rounded-lg border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {call.referenceId ? `Question #${call.referenceId}` : "Follow-up conversation"}
        </p>
        <p className="text-xs text-ink-soft">${earnings(call.priceCents)} to you</p>
      </div>
      <p className="mt-1 text-base font-semibold text-ink">{formatLocal(call.confirmedStart)}</p>
      <p className="text-xs text-ink-soft">15 minutes</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!open || joining}
          onClick={onJoin}
          className="rounded-full bg-postal-red px-5 py-2 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
        >
          {joining ? "Opening..." : "Join conversation"}
        </button>
        {!open && now < opensAt.getTime() && (
          <span className="text-xs text-ink-soft">
            Opens at {formatLocal(opensAt.toISOString(), false)} (10 minutes before)
          </span>
        )}
        {!open && now > closesAt.getTime() && (
          <span className="text-xs text-ink-soft">The join window has closed.</span>
        )}
      </div>

      {call.videoProvider === "dmq" && !started && (
        <div className="mt-3">
          {!ownLinkOpen ? (
            <button type="button" onClick={() => setOwnLinkOpen(true)} className={linkButton}>
              Trouble with the call? Use my own meeting link
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-ink" htmlFor={`own-${call.id}`}>
                Your meeting link
              </label>
              <input
                id={`own-${call.id}`}
                type="url"
                inputMode="url"
                value={ownLink}
                onChange={(e) => setOwnLink(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60"
              />
              <p className="text-xs text-ink-soft">
                The asker is emailed straight away and their join page then opens this link.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={busy || ownLink.trim().length === 0}
                  onClick={() => onUseOwnLink(ownLink)}
                  className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-white hover:bg-postal-blue disabled:opacity-50"
                >
                  Move to my link
                </button>
                <button type="button" onClick={() => setOwnLinkOpen(false)} className={linkButton}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {started && reporting ? (
        <div className="mt-4 border-t border-line pt-3">
          <ReportProblemForm
            role="expert"
            busy={busy}
            onCancel={() => setReporting(false)}
            onSubmit={(reason, note) => {
              onReport(reason, note)
              setReporting(false)
            }}
          />
        </div>
      ) : started && call.expertMarked ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs text-ink-soft">
            {call.expertMarked === "completed"
              ? "You marked this completed."
              : "You said the asker didn't join."}{" "}
            The asker has been asked to confirm. You&apos;re paid when they do,
            or automatically about a day after the call if no problem is
            reported.
          </p>
          <div className="mt-2">
            <button type="button" disabled={busy} onClick={() => setReporting(true)} className={linkButton}>
              Report a problem
            </button>
          </div>
        </div>
      ) : started ? (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs text-ink-soft">
            How did it go? Let us know
            {call.askerJoined ? "" : ", or tell us if the asker never joined"}.
            The asker is asked to confirm; you&apos;re paid when they do, or
            automatically about a day after the call if no problem is reported.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={onComplete}
              className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink hover:border-postal-red hover:text-postal-red disabled:opacity-50"
            >
              Mark completed
            </button>
            <button
              type="button"
              disabled={busy || !noShowAllowed}
              onClick={onAskerNoShow}
              title={
                call.askerJoined
                  ? "The asker opened the join page, so this isn't available."
                  : !noShowAllowed
                    ? "Available once the 15-minute slot has ended."
                    : undefined
              }
              className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink hover:border-postal-red hover:text-postal-red disabled:opacity-50"
            >
              Asker didn&apos;t join
            </button>
            <button type="button" disabled={busy} onClick={() => setReporting(true)} className={linkButton}>
              Report a problem
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button type="button" disabled={busy} onClick={onCancel} className={linkButton}>
            Cancel this conversation
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-postal-red">{error}</p>}
    </div>
  )
}

// What each ending means for the expert, in plain words.
function describeEnding(call: FollowUpCall): string {
  switch (call.status) {
    case "completed":
      return "Completed"
    case "declined":
      return "You declined"
    case "expired":
      return "Expired, not confirmed in time"
    case "cancelled":
      return call.cancelledBy === "expert"
        ? "Cancelled by you"
        : call.cancelledBy === "asker"
          ? "Cancelled by the asker"
          : "Cancelled"
    case "late_cancelled":
      return "Cancelled late by the asker"
    case "asker_no_show":
      return "The asker didn't join"
    case "expert_no_show":
      return "Missed, the asker wasn't charged"
    case "disputed":
      return "Under review"
    default:
      return call.status
  }
}

// What the expert gets (or is waiting on), if anything.
function describeMoney(call: FollowUpCall): string | null {
  const net = `$${earnings(call.priceCents)}`
  switch (call.status) {
    case "completed":
    case "late_cancelled":
    case "asker_no_show":
      return `${net} to you`
    case "disputed":
      return `${net} on hold`
    default:
      return null
  }
}

export function PastRow({ call }: { call: FollowUpCall }) {
  const when = call.confirmedStart ? formatLocal(call.confirmedStart, false) : null
  const money = describeMoney(call)
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
      <span className="text-ink">
        {call.referenceId ? `Question #${call.referenceId}` : "Follow-up conversation"}
        {when && <span className="text-ink-soft"> · {when}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {money && <span className="text-xs text-ink-soft">{money}</span>}
        <span className="rounded-full bg-line/50 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
          {describeEnding(call)}
        </span>
      </span>
    </li>
  )
}
