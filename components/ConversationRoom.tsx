"use client"

import { useEffect, useState } from "react"
import { videoRoomWindowFor } from "@/lib/follow-up-rules"

function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

// A DMQ-hosted conversation: the call itself, inside the page, with a live
// countdown to the scheduled end and to the room closing. The camera starts
// off. Leaving removes the call; joining again makes a fresh pass.
export default function ConversationRoom({
  url,
  startIso,
  onLeave,
}: {
  url: string
  startIso: string
  onLeave: () => void
}) {
  const { scheduledEnd, closesAt } = videoRoomWindowFor(startIso)
  const [now, setNow] = useState<number | null>(null)

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
  if (now !== null) {
    if (now < scheduledEnd.getTime()) {
      status = `Time left in the conversation: ${mmss(scheduledEnd.getTime() - now)}`
    } else if (now < closesAt.getTime()) {
      status = `The 15 minutes are up. The room closes in ${mmss(closesAt.getTime() - now)}.`
    } else {
      status = "The room has closed."
    }
  }

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          {status}
        </p>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink hover:border-postal-red hover:text-postal-red"
        >
          Leave conversation
        </button>
      </div>
      <iframe
        src={url}
        allow="camera; microphone; autoplay; fullscreen"
        title="Your conversation"
        className="mt-3 h-[520px] w-full rounded-lg border border-line"
      />
      <p className="mt-2 text-xs text-ink-soft">
        Your camera starts off. Turn it on from the call controls if you want to.
        This conversation isn&apos;t recorded.
      </p>
    </div>
  )
}
