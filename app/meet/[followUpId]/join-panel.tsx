"use client"

import { useEffect, useState } from "react"
import { formatSlot, videoRoomWindowFor } from "@/lib/follow-up-rules"
import { VideoIcon } from "@/components/icons"
import ConversationRoom from "@/components/ConversationRoom"
import { detectInAppBrowser } from "@/lib/video/in-app-browser"

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
}: {
  followUpId: string
  expertFirstName: string
  startIso: string
  timezone: string | null
}) {
  const [now, setNow] = useState<number | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState("")
  // The call, once joined, when it is held on DMQ.
  const [roomUrl, setRoomUrl] = useState<string | null>(null)
  // Set after load (it depends on the visitor's browser): an app's built-in
  // browser often can't use the microphone.
  const [browserHint, setBrowserHint] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  // True once they have left the call on this page.
  const [left, setLeft] = useState(false)

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

  // The call is only shown while its room is open; once the room has closed
  // the person is moved to the post-call screen, not left on an empty video.
  const roomClosed =
    now !== null && now > videoRoomWindowFor(startIso).closesAt.getTime()
  const inCall = Boolean(roomUrl) && !roomClosed

  // Lets the actions below the call know whether the call is open here.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("dmq-room-state", { detail: inCall }))
  }, [inCall])

  // The call's "Request a new time" ends this conversation; the page then
  // shows that it's released and offers a new time.
  useEffect(() => {
    async function reschedule() {
      setRescheduling(true)
      setError("")
      try {
        const res = await fetch("/api/follow-up/reschedule-live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: followUpId }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          setError(typeof data?.error === "string" ? data.error : JOIN_ERROR)
          setRescheduling(false)
          return
        }
        window.location.reload()
      } catch {
        setError(JOIN_ERROR)
        setRescheduling(false)
      }
    }
    window.addEventListener("dmq-reschedule", reschedule)
    return () => window.removeEventListener("dmq-reschedule", reschedule)
  }, [followUpId])

  useEffect(() => {
    const t = setTimeout(() => {
      const app = detectInAppBrowser(navigator.userAgent)
      if (app) {
        setBrowserHint(
          `You're viewing this inside ${app === "another app" ? "another app" : app}. The microphone often doesn't work there, so open this page in Safari or Chrome before the conversation.`
        )
      } else if (!navigator.mediaDevices?.getUserMedia) {
        setBrowserHint(
          "This browser can't use a microphone for calls. Open this page in Safari or Chrome."
        )
      }
    }, 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setJoining(false)
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [])

  const { opensAt, closesAt } = videoRoomWindowFor(startIso)
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

  if (inCall && roomUrl) {
    return (
      <>
        <ConversationRoom
          url={roomUrl}
          startIso={startIso}
          onLeave={() => {
            setRoomUrl(null)
            setLeft(true)
          }}
          onReport={() => window.dispatchEvent(new Event("dmq-open-report"))}
          onReschedule={() => window.dispatchEvent(new Event("dmq-reschedule"))}
          busy={rescheduling}
        />
        {error && <p className="mt-3 text-center text-sm text-postal-red">{error}</p>}
      </>
    )
  }

  // After the call, once the 15 minutes are up: a plain screen that points to
  // the next step below, not the join card.
  const joinedHere = left || Boolean(roomUrl)
  if (
    joinedHere &&
    now !== null &&
    now >= videoRoomWindowFor(startIso).scheduledEnd.getTime()
  ) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
          <VideoIcon className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl text-ink">Your conversation has ended</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Thank you for talking with {expertFirstName}. Let us know how it went below.
        </p>
        {state === "open" && (
          <p className="mt-4 text-xs text-ink-soft">
            Left by mistake?{" "}
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="font-medium text-ink underline underline-offset-2 hover:text-postal-blue disabled:opacity-50"
            >
              {joining ? "Opening..." : "Rejoin the conversation"}
            </button>
          </p>
        )}
        {error && <p className="mt-3 text-sm text-postal-red">{error}</p>}
      </div>
    )
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

      {browserHint && (
        <div className="mt-5 rounded-lg border border-line bg-paper p-3 text-left text-xs text-ink">
          <p>{browserHint}</p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.writeText(window.location.href)
                .then(() => setLinkCopied(true))
                .catch(() => setLinkCopied(false))
            }}
            className="mt-2 font-medium text-ink underline underline-offset-2"
          >
            {linkCopied ? "Link copied. Paste it into your browser." : "Copy this page's link"}
          </button>
        </div>
      )}

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
            {joining ? "Opening..." : <>{left ? "Rejoin conversation" : "Join conversation"} <span aria-hidden>→</span></>}
          </button>
          <p className="mt-2 text-xs text-ink-soft">
            This opens your conversation right here. Your camera starts off.
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
