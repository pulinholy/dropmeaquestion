"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

// Proof of concept for DMQ-hosted video rooms (admin only, no real booking).
// See docs/video-provider-comparison.md.

type RoomResult = {
  room: string
  closesAt: string
  expertUrl: string
  guestUrl: string
}

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
    const json = await post({ action: "room", expertName })
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
        if (!cancelled && res.ok) setEvents(json.events ?? [])
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
            Room <span className="font-mono text-xs">{result.room}</span> is open until{" "}
            {new Date(result.closesAt).toLocaleTimeString()}. Open the other pass in a
            different browser or on your phone to test both sides.
          </p>
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
