"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { formatDuration, type ConnectionSummary } from "@/lib/video/connection-summary"

// Proof of concept for DMQ-hosted video rooms (admin only, no real booking).
// See docs/video-provider-comparison.md.

type RoomResult = {
  room: string
  startsAt: string
  scheduledEnd: string
  opensAt: string
  closesAt: string
  expertUrl: string
  guestUrl: string
}

type RoomSummary = ConnectionSummary & { room: string }

type VideoEvent = {
  id: string
  type: string
  room: string | null
  user_name: string | null
  user_id: string | null
  occurred_at: string | null
  received_at: string
}

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error("Please log in again.")
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
  })
}

export default function VideoPocPage() {
  const [expertName, setExpertName] = useState("Priya Sharma")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [result, setResult] = useState<RoomResult | null>(null)
  const [events, setEvents] = useState<VideoEvent[]>([])
  const [summaries, setSummaries] = useState<RoomSummary[]>([])
  const [startsIn, setStartsIn] = useState(10)
  const [closesAfter, setClosesAfter] = useState(20)
  const [now, setNow] = useState(() => Date.now())
  const [embed, setEmbed] = useState<"expert" | "guest">("expert")

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const res = await authedFetch("/api/admin/video-poc", {
        method: "POST",
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error ?? "Something went wrong.")
        return null
      }
      return json
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setBusy(false)
    }
  }

  async function createRoom() {
    const json = await post({
      action: "room",
      expertName,
      callStartsInMinutes: startsIn,
      closesAfterStartMinutes: closesAfter,
    })
    if (json) setResult(json as RoomResult)
  }

  async function registerWebhook() {
    const json = await post({ action: "webhook" })
    if (json) setMessage("Webhook registered. Join the room and watch the events below.")
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await authedFetch("/api/admin/video-poc")
        const json = await res.json().catch(() => null)
        if (!cancelled && res.ok) {
          setEvents(json.events ?? [])
          setSummaries(json.summaries ?? [])
        }
      } catch {
        // The list simply stays as it was.
      }
    }
    load()
    const timer = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  // Ticks once a second so the countdown below is live.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  function countdown(): string {
    if (!result) return ""
    const left = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000))
    const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
    if (now < new Date(result.opensAt).getTime()) return `Room opens in ${mmss(left(result.opensAt))}`
    if (now < new Date(result.startsAt).getTime()) return `Call starts in ${mmss(left(result.startsAt))}`
    if (now < new Date(result.scheduledEnd).getTime())
      return `Call time left: ${mmss(left(result.scheduledEnd))}`
    if (now < new Date(result.closesAt).getTime())
      return `Grace period: room closes in ${mmss(left(result.closesAt))}`
    return "Room closed"
  }

  const activeUrl = result ? (embed === "expert" ? result.expertUrl : result.guestUrl) : null

  return (
    <section>
      <h1 className="font-display text-2xl text-ink">Video proof of concept</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Makes a private room with one pass for the expert (their profile name) and one
        for a guest. Everyone joins audio-first: the camera starts off and can be
        turned on. Admin only; no real booking is involved.
      </p>

      <div className="mt-6 rounded-lg border border-line bg-card p-5">
        <label htmlFor="expert-name" className="text-sm font-medium text-ink">
          Expert display name
        </label>
        <input
          id="expert-name"
          value={expertName}
          onChange={(e) => setExpertName(e.target.value)}
          className="mt-1 block w-full max-w-sm rounded-sm border border-line px-3 py-2 text-sm"
        />
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink">
          <label className="flex items-center gap-2">
            Call starts in
            <input
              type="number"
              min={0}
              max={120}
              value={startsIn}
              onChange={(e) => setStartsIn(Number(e.target.value))}
              className="w-16 rounded-sm border border-line px-2 py-1"
            />
            min
          </label>
          <label className="flex items-center gap-2">
            Room closes
            <input
              type="number"
              min={1}
              max={60}
              value={closesAfter}
              onChange={(e) => setClosesAfter(Number(e.target.value))}
              className="w-16 rounded-sm border border-line px-2 py-1"
            />
            min after the start
          </label>
          <span className="text-xs text-ink-soft">
            Real rules: the room opens 10 min before the start and closes 20 min after it (15-minute call + 5 min grace). To try an early join: call starts in 20. To try the ejection quickly: closes 3 min after the start.
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={createRoom}
            className="rounded-full bg-postal-red px-5 py-2 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
          >
            {busy ? "Working..." : "Create a test room"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={registerWebhook}
            className="rounded-full border border-line px-5 py-2 text-sm font-medium text-ink hover:bg-line/40 disabled:opacity-50"
          >
            Register webhook (once)
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-postal-red">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      </div>

      {result && activeUrl && (
        <div className="mt-6 rounded-lg border border-line bg-card p-5">
          <p className="text-sm text-ink">
            Room <span className="font-mono text-xs">{result.room}</span> opens at{" "}
            {new Date(result.opensAt).toLocaleTimeString()}, the call starts at{" "}
            {new Date(result.startsAt).toLocaleTimeString()}, and the room closes at{" "}
            {new Date(result.closesAt).toLocaleTimeString()}. Open the other pass in a
            different browser or on your phone to test both sides.
          </p>
          <p className="mt-2 text-sm font-semibold text-ink">{countdown()}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setEmbed("expert")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium ${embed === "expert" ? "bg-ink text-white" : "border border-line text-ink"}`}
            >
              Embed expert view
            </button>
            <button
              type="button"
              onClick={() => setEmbed("guest")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium ${embed === "guest" ? "bg-ink text-white" : "border border-line text-ink"}`}
            >
              Embed guest view
            </button>
            <a
              href={result.expertUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-postal-blue underline underline-offset-2"
            >
              Open expert pass in a tab
            </a>
            <a
              href={result.guestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-postal-blue underline underline-offset-2"
            >
              Open guest pass in a tab
            </a>
          </div>
          <iframe
            key={activeUrl}
            src={activeUrl}
            allow="camera; microphone; autoplay; display-capture; fullscreen"
            className="mt-4 h-[520px] w-full rounded-lg border border-line"
            title="DMQ conversation room"
          />
        </div>
      )}

      {summaries.map((s) => (
        <div key={s.room} className="mt-6 rounded-lg border border-line bg-card p-5">
          <h2 className="text-sm font-semibold text-ink">
            Conversation <span className="font-mono text-xs">{s.room.slice(0, 12)}</span>
          </h2>
          {(["expert", "asker"] as const).map((role) => (
            <div key={role} className="mt-2 flex items-center justify-between text-sm">
              <span className="text-ink-soft">
                {role === "expert" ? "Expert joined" : "Asker joined"}
              </span>
              <span className="text-right text-ink">
                {!s[role].joined ? "Not joined" : s[role].connected ? "Connected" : "Left"}
                {s[role].reconnects > 0 && (
                  <span className="ml-2 text-xs text-ink-soft">
                    {s[role].reconnects} reconnect{s[role].reconnects === 1 ? "" : "s"}
                  </span>
                )}
              </span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-ink-soft">Shared connection time</span>
            <span className="font-semibold text-ink">{formatDuration(s.sharedSeconds)}</span>
          </div>
          <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
            Connection data can support troubleshooting and payment reviews, but does not prove the
            quality of the conversation.
          </p>
        </div>
      ))}

      <div className="mt-6 rounded-lg border border-line bg-card p-5">
        <h2 className="text-sm font-semibold text-ink">Join and leave events received</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-xs text-ink-soft">
            None yet. Needs the webhook registered and supabase/video_poc.sql run.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line text-xs">
            {events.map((e) => (
              <li key={e.id} className="py-1.5">
                <span className="font-medium text-ink">{e.type}</span>{" "}
                <span className="text-ink-soft">
                  {e.user_name ? `· ${e.user_name}` : ""}{" "}
                  {e.occurred_at ? `· ${new Date(e.occurred_at).toLocaleTimeString()}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
