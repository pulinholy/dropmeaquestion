"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import {
  PastRow,
  RequestCard,
  UpcomingCard,
  type FollowUpCall,
} from "./conversation-cards"

type Loaded = {
  available: boolean
  enabled: boolean
  calls: FollowUpCall[]
}

const GENERIC_ERROR = "Something went wrong. Please try again."

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error("Please log in again.")
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...(init?.headers ?? {}),
    },
  })
}

export default function ConversationsPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [now, setNow] = useState(() => Date.now())
  // Bumping this reloads the list, e.g. after confirming or declining.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authedFetch("/api/follow-up/mine")
        if (!res.ok) throw new Error()
        const json = await res.json()
        if (cancelled) return
        setLoaded(json)
        setLoadError("")
      } catch {
        if (!cancelled) {
          setLoadError("We couldn't load your conversations. Please refresh the page.")
        }
      }
      if (!cancelled) {
        setBusyId(null)
        setJoiningId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // The Join button unlocks on its own as the start time approaches.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  function setError(id: string, message: string) {
    setErrors((current) => ({ ...current, [id]: message }))
  }

  async function act(id: string, path: string, body: Record<string, unknown>) {
    setBusyId(id)
    setError(id, "")
    try {
      const res = await authedFetch(path, { method: "POST", body: JSON.stringify(body) })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(id, typeof data?.error === "string" ? data.error : GENERIC_ERROR)
      }
    } catch {
      setError(id, GENERIC_ERROR)
    }
    setReloadKey((k) => k + 1)
  }

  async function join(call: FollowUpCall) {
    setJoiningId(call.id)
    setError(call.id, "")
    // Opened straight away, inside the click, so pop-up blockers allow it.
    const tab = window.open("", "_blank")
    try {
      const res = await authedFetch("/api/follow-up/join", {
        method: "POST",
        body: JSON.stringify({ id: call.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.url !== "string") {
        tab?.close()
        setError(call.id, typeof data?.error === "string" ? data.error : GENERIC_ERROR)
      } else if (tab) {
        tab.location.assign(data.url)
      } else {
        window.location.assign(data.url)
      }
    } catch {
      tab?.close()
      setError(call.id, GENERIC_ERROR)
    }
    setReloadKey((k) => k + 1)
  }

  if (loadError) return <p className="text-postal-red">{loadError}</p>
  if (!loaded) return <p className="text-ink-soft">Loading...</p>

  const requests = loaded.calls.filter((c) => c.status === "requested")
  const upcoming = loaded.calls
    .filter((c) => c.status === "confirmed")
    .sort(
      (a, b) =>
        new Date(a.confirmedStart ?? 0).getTime() - new Date(b.confirmedStart ?? 0).getTime()
    )
  const past = loaded.calls.filter((c) => c.status !== "requested" && c.status !== "confirmed")

  return (
    <section>
      <h1 className="font-display text-2xl text-ink">Conversations</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Optional 15-minute follow-ups that askers request after you&apos;ve
        answered their question.
      </p>

      {!loaded.available && (
        <p className="mt-6 text-sm text-ink-soft">
          Follow-up conversations aren&apos;t available yet.
        </p>
      )}

      {loaded.available && !loaded.enabled && loaded.calls.length === 0 && (
        <div className="mt-6 rounded-lg border border-line bg-card p-5 text-sm text-ink-soft">
          Follow-up conversations are off. Turn them on in{" "}
          <Link
            href="/dashboard/pricing"
            className="font-medium text-postal-blue underline underline-offset-2"
          >
            Pricing
          </Link>{" "}
          to let askers book a call with you after you answer.
        </div>
      )}

      {loaded.available && loaded.enabled && loaded.calls.length === 0 && (
        <div className="mt-6 rounded-lg border border-line bg-card p-5 text-sm text-ink-soft">
          Nothing yet. After you answer a question, the asker&apos;s email offers
          a follow-up conversation, and requests will appear here.
        </div>
      )}

      {requests.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-lg text-ink">
            Waiting for you ({requests.length})
          </h2>
          <div className="mt-3 space-y-3">
            {requests.map((call) => (
              <RequestCard
                key={call.id}
                call={call}
                busy={busyId === call.id}
                error={errors[call.id] ?? ""}
                onConfirm={(slot, meetingLink) =>
                  act(call.id, "/api/follow-up/confirm", { id: call.id, slot, meetingLink })
                }
                onDecline={() => act(call.id, "/api/follow-up/decline", { id: call.id })}
              />
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg text-ink">Upcoming</h2>
          <div className="mt-3 space-y-3">
            {upcoming.map((call) => (
              <UpcomingCard
                key={call.id}
                call={call}
                now={now}
                joining={joiningId === call.id}
                busy={busyId === call.id}
                error={errors[call.id] ?? ""}
                onJoin={() => join(call)}
                onCancel={() => {
                  if (
                    window.confirm(
                      "Cancel this conversation? The asker won't be charged."
                    )
                  ) {
                    act(call.id, "/api/follow-up/cancel-expert", { id: call.id })
                  }
                }}
                onComplete={() => {
                  if (window.confirm("Mark this conversation as completed? The asker is charged and you're paid.")) {
                    act(call.id, "/api/follow-up/complete", { id: call.id, outcome: "completed" })
                  }
                }}
                onAskerNoShow={() => {
                  if (
                    window.confirm(
                      "The asker never opened the join page. Mark them as not joining? They're charged in full under the cancellation policy and you're paid."
                    )
                  ) {
                    act(call.id, "/api/follow-up/complete", { id: call.id, outcome: "asker_no_show" })
                  }
                }}
                onReport={(reason, note) =>
                  act(call.id, "/api/follow-up/report-problem", { id: call.id, reason, note })
                }
              />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg text-ink">Past</h2>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-card px-4">
            {past.map((call) => (
              <PastRow key={call.id} call={call} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
