"use client"

import { useEffect, useState } from "react"
import { formatSlot, joinWindowFor, videoRoomWindowFor } from "@/lib/follow-up-rules"
import { VideoIcon } from "@/components/icons"
import ConversationRoom from "@/components/ConversationRoom"

const JOIN_ERROR = "We couldn't open the conversation. Please try again in a moment."

function describeWait(ms: number): string {
  const minutes = Math.ceil(ms / 60000)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`
  return `${Math.floor(hours / 24)} days`
}

export default function JoinPanel({
  followUpId,
  expertFirstName,
  startIso,
  timezone,
  videoProvider,
}: {
  followUpId: string
  expertFirstName: string
  startIso: string
  timezone: string | null
  videoProvider: "dmq" | "external"
}) {
  const [now, setNow] = useState<number | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState("")
  // The call, once joined, when it is held on DMQ.
  const [roomUrl, setRoomUrl] = useState<string | null>(null)

  // Starts null so the server-rendered page and the first client render match.
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 15000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setJoining(false)
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [])

  const { opensAt, closesAt } =
    videoProvider === "dmq" ? videoRoomWindowFor(startIso) : joinWindowFor(startIso)
  const state =
    now === null
      ? "loading"
      : now < opensAt.getTime()
        ? "before"
        : now <= closesAt.getTime()
          ? "open"
          : "ended"

  async function handleJoin() {
    setJoining(true)
    setError("")
    try {
      const res = await fetch("/api/follow-up/join-asker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: followUpId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.url !== "string") {
        setError(typeof data?.error === "string" ? data.error : JOIN_ERROR)
        setJoining(false)
        return
      }
      if (data.mode === "embedded") {
        setRoomUrl(data.url)
        setJoining(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError(JOIN_ERROR)
      setJoining(false)
    }
  }

  if (roomUrl) {
    return <ConversationRoom url={roomUrl} startIso={startIso} onLeave={() => setRoomUrl(null)} />
  }

  return (
    <div className="rounded-lg border border-line bg-white p-6 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
        <VideoIcon className="h-6 w-6" />
      </span>
      <h1 className="mt-4 font-display text-2xl text-ink">
        Your conversation with {expertFirstName}
      </h1>
      <p className="mt-2 text-lg font-semibold text-ink">
        {formatSlot(startIso, timezone)}
      </p>
      <p className="mt-0.5 text-xs text-ink-soft">15 minutes</p>

      {state === "before" && now !== null && (
        <div className="mt-5">
          <p className="text-sm text-ink-soft">
            The join button appears 10 minutes before the start, in about{" "}
            <strong className="text-ink">{describeWait(opensAt.getTime() - now)}</strong>.
            Keep this page, or the email, handy.
          </p>
        </div>
      )}

      {state === "open" && (
        <div className="mt-5">
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink disabled:opacity-50"
          >
            {joining ? "Opening..." : <>Join conversation <span aria-hidden>→</span></>}
          </button>
          <p className="mt-2 text-xs text-ink-soft">
            {videoProvider === "dmq"
              ? "This opens your conversation right here. Your camera starts off."
              : `This opens ${expertFirstName}'s video meeting.`}
          </p>
        </div>
      )}

      {state === "ended" && (
        <p className="mt-5 text-sm text-ink-soft">
          The join window for this conversation has closed.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-postal-red">{error}</p>}
    </div>
  )
}
