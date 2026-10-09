"use client"

import { useEffect, useState } from "react"
import { videoRoomWindowFor } from "@/lib/follow-up-rules"

function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

function clock(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

// A DMQ-hosted conversation: the call itself, inside the page, with a live
// countdown to the scheduled end and to the room closing. The camera starts
// off. Leaving removes the call; joining again makes a fresh pass.
export default function ConversationRoom({
  url,
  startIso,
  onLeave,
  onReport,
}: {
  url: string
  startIso: string
  onLeave: () => void
  // Opens the "report a problem" form on the page that shows the call.
  onReport: () => void
}) {
  const { scheduledEnd, closesAt } = videoRoomWindowFor(startIso)
  const start = new Date(startIso).getTime()
  const [now, setNow] = useState<number | null>(null)
  // Bumped to load the call again on the same pass, if the connection stalls.
  const [reloadKey, setReloadKey] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)

  // Starts null so the server render and the first client render match.
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0)
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])

  let status = ""
  // Spoken to screen readers only when it changes, which is only at these
  // milestones. The ticking clock above is deliberately not announced.
  let milestone = ""
  if (now !== null) {
    const left = scheduledEnd.getTime() - now
    if (left > 0) {
      status = `Time left ${mmss(left)} · ends at ${clock(scheduledEnd)}`
      if (left <= 60 * 1000) milestone = "One minute left in the conversation."
      else if (left <= 5 * 60 * 1000) milestone = "Five minutes left in the conversation."
    } else if (now < closesAt.getTime()) {
      status = `The 15 minutes are up. The room closes in ${mmss(closesAt.getTime() - now)}.`
      milestone = "The 15 minutes are up. The room will close shortly."
    } else {
      status = "The room has closed."
      milestone = "The room has closed."
    }
  }
  const started = now !== null && now >= start

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{status}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setHelpOpen((open) => !open)}
            aria-expanded={helpOpen}
            className="text-xs font-medium text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            Connection help
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink hover:border-postal-red hover:text-postal-red"
          >
            Leave conversation
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {milestone}
      </p>

      {helpOpen && (
        <div className="mt-3 rounded-sm bg-line/30 p-3 text-xs text-ink-soft">
          <p>
            No sound or no picture? Reloading the call usually fixes it. If something went
            wrong on our side or the other person&apos;s, report it and we&apos;ll review it.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-medium text-ink hover:border-ink"
            >
              Reload the call
            </button>
            {started ? (
              <button
                type="button"
                onClick={onReport}
                className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-medium text-ink hover:border-postal-red hover:text-postal-red"
              >
                Report a problem
              </button>
            ) : (
              <span>You can report a problem once the conversation has started.</span>
            )}
          </div>
        </div>
      )}

      <iframe
        key={reloadKey}
        src={url}
        allow="camera; microphone; autoplay; fullscreen"
        title="Your conversation"
        className="mt-3 h-[520px] w-full rounded-lg border border-line"
      />
      <p className="mt-2 text-xs text-ink-soft">
        Your camera starts off. Turn it on from the call controls if you want to.
      </p>
    </div>
  )
}
