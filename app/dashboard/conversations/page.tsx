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
import ConversationRoom from "@/components/ConversationRoom"
import ReportProblemForm from "@/components/ReportProblemForm"

type Loaded = {
  available: boolean
  enabled: boolean
  videoMode?: "dmq" | "external"
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

type TabKey = "requests" | "upcoming" | "completed" | "review" | "ended"

// Every status a conversation can have, grouped into five tabs:
//   requests  requested
//   upcoming  confirmed
//   completed completed
//   review    disputed (a problem was reported, or a person has to decide)
//   ended     declined, expired, cancelled, late_cancelled, asker_no_show,
//             expert_no_show
const TABS: { key: TabKey; label: string; empty: string }[] = [
  {
    key: "requests",
    label: "Requests",
    empty:
      "No requests waiting. When an asker asks for a conversation after your answer, it appears here for you to confirm.",
  },
  { key: "upcoming", label: "Upcoming", empty: "No upcoming conversations." },
  { key: "completed", label: "Completed", empty: "No completed conversations yet." },
  {
    key: "review",
    label: "Under review",
    empty:
      "Nothing is under review. If a problem is reported, or a conversation needs checking, it appears here while the payment is on hold.",
  },
  { key: "ended", label: "Cancelled & missed", empty: "No cancelled or missed conversations." },
]

export default function ConversationsPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  // A conversation held on DMQ, while the expert is in it.
  const [room, setRoom] = useState<{
    url: string
    startIso: string
    id: string
    referenceId: string | null
  } | null>(null)
  const [roomReporting, setRoomReporting] = useState(false)
  // The chosen tab; until one is chosen, the first tab that has something in it.
  const [chosenTab, setChosenTab] = useState<TabKey | null>(null)
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

  useEffect(() => {
    const t = setTimeout(() => {
      const wanted = new URLSearchParams(window.location.search).get("tab")
      if (TABS.some((tab) => tab.key === wanted)) setChosenTab(wanted as TabKey)
    }, 0)
    return () => clearTimeout(t)
  }, [])

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
    const onDmq = call.videoProvider === "dmq"
    // A link opens in a new tab, which has to be made inside the click so
    // pop-up blockers allow it. A DMQ conversation opens on this page.
    const tab = onDmq ? null : window.open("", "_blank")
    try {
      const res = await authedFetch("/api/follow-up/join", {
        method: "POST",
        body: JSON.stringify({ id: call.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.url !== "string") {
        tab?.close()
        setError(call.id, typeof data?.error === "string" ? data.error : GENERIC_ERROR)
      } else if (data.mode === "embedded" && call.confirmedStart) {
        setRoom({
          url: data.url,
          startIso: call.confirmedStart,
          id: call.id,
          referenceId: call.referenceId,
        })
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
  const completed = loaded.calls.filter((c) => c.status === "completed")
  const review = loaded.calls.filter((c) => c.status === "disputed")
  const ended = loaded.calls.filter(
    (c) => !["requested", "confirmed", "completed", "disputed"].includes(c.status)
  )
  const counts: Record<TabKey, number> = {
    requests: requests.length,
    upcoming: upcoming.length,
    completed: completed.length,
    review: review.length,
    ended: ended.length,
  }
  const activeTab: TabKey =
    chosenTab ??
    (["requests", "upcoming", "review", "completed", "ended"] as TabKey[]).find(
      (key) => counts[key] > 0
    ) ??
    "requests"

  function chooseTab(key: TabKey) {
    setChosenTab(key)
    window.history.replaceState(null, "", `?tab=${key}`)
  }

  // In a call, the call is the page: no lists or notices beside it.
  if (room) {
    return (
      <section>
        <h1 className="font-display text-2xl text-ink">
          Conversation{room.referenceId ? ` for Question #${room.referenceId}` : ""}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">15-minute follow-up · Guest</p>
        <div className="mt-4">
          <ConversationRoom
            url={room.url}
            startIso={room.startIso}
            onLeave={() => {
              setRoom(null)
              setRoomReporting(false)
            }}
            onReport={() => setRoomReporting(true)}
          />
        </div>
        {roomReporting && (
          <div className="mt-4 rounded-lg border border-line bg-card p-5">
            <ReportProblemForm
              role="expert"
              busy={busyId === room.id}
              onCancel={() => setRoomReporting(false)}
              onSubmit={(reason, note) => {
                act(room.id, "/api/follow-up/report-problem", { id: room.id, reason, note })
                setRoomReporting(false)
              }}
            />
          </div>
        )}
        {errors[room.id] && <p className="mt-3 text-sm text-postal-red">{errors[room.id]}</p>}
      </section>
    )
  }

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

      {loaded.available && loaded.calls.length > 0 && (
        <>
          <div className="mt-4 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => {
              const active = tab.key === activeTab
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => chooseTab(tab.key)}
                  className={`flex-shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                    active
                      ? "border-postal-red text-postal-red"
                      : "border-transparent text-ink-soft hover:text-ink"
                  }`}
                >
                  {tab.label} ({counts[tab.key]})
                </button>
              )
            })}
          </div>

          <div className="mt-4 space-y-3">
            {counts[activeTab] === 0 && (
              <p className="text-ink-soft">{TABS.find((t) => t.key === activeTab)?.empty}</p>
            )}

            {activeTab === "requests" &&
              requests.map((call) => (
                  <RequestCard
                    key={call.id}
                    call={call}
                    busy={busyId === call.id}
                    error={errors[call.id] ?? ""}
                    videoMode={loaded.videoMode}
                    onConfirm={(slot, meetingLink) =>
                      act(call.id, "/api/follow-up/confirm", { id: call.id, slot, meetingLink })
                    }
                    onDecline={() => act(call.id, "/api/follow-up/decline", { id: call.id })}
                  />
              ))}

            {activeTab === "upcoming" &&
              upcoming.map((call) => (
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
                      if (window.confirm("Mark this conversation as completed? The asker is asked to confirm. You're paid when they do, or automatically about a day after if no problem is reported.")) {
                        act(call.id, "/api/follow-up/complete", { id: call.id, outcome: "completed" })
                      }
                    }}
                    onAskerNoShow={() => {
                      if (
                        window.confirm(
                          "The asker never opened the join page. Mark them as not joining? They're asked to confirm, and under the cancellation policy they're charged in full about a day later unless they report a problem. You're paid when they are."
                        )
                      ) {
                        act(call.id, "/api/follow-up/complete", { id: call.id, outcome: "asker_no_show" })
                      }
                    }}
                    onUseOwnLink={(meetingLink) =>
                      act(call.id, "/api/follow-up/use-own-link", { id: call.id, meetingLink })
                    }
                    onReport={(reason, note) =>
                      act(call.id, "/api/follow-up/report-problem", { id: call.id, reason, note })
                    }
                  />
              ))}

            {activeTab === "review" && review.length > 0 && (
              <p className="rounded-lg border border-line bg-card p-4 text-sm text-ink-soft">
                A problem was reported, or the connection record needs a person to check. The payment
                is on hold until we decide, and we&apos;ll email you.
              </p>
            )}

            {(activeTab === "completed" || activeTab === "review" || activeTab === "ended") &&
              counts[activeTab] > 0 && (
                <ul className="divide-y divide-line rounded-lg border border-line bg-card px-4">
                  {(activeTab === "completed" ? completed : activeTab === "review" ? review : ended).map(
                    (call) => (
                      <PastRow key={call.id} call={call} />
                    )
                  )}
                </ul>
              )}
          </div>
        </>
      )}
    </section>
  )
}
