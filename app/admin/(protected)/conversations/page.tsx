"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { problemReasonLabel } from "@/lib/follow-up-rules"
import { formatDuration } from "@/lib/video/connection-summary"

type Dispute = {
  id: string
  referenceId: string | null
  expertName: string
  priceCents: number
  confirmedStart: string | null
  captureBefore: string | null
  reportedAt: string | null
  reportedBy: string | null
  problemReason: string | null
  problemNote: string | null
  // Present for conversations held on DMQ.
  connection: {
    expert: { joined: boolean; connected: boolean; reconnects: number }
    asker: { joined: boolean; connected: boolean; reconnects: number }
    sharedSeconds: number
  } | null
  events: { event: string; actor: string; detail: Record<string, unknown> | null; at: string }[]
  reason: string | null
  askerJoinedAt: string | null
  expertJoinedAt: string | null
}

const RESOLUTIONS = [
  {
    key: "capture",
    label: "Conversation happened — charge asker, pay expert",
    confirm: "Charge the asker and pay the expert for this conversation?",
    style: "bg-green-600 text-white hover:bg-green-700",
  },
  {
    key: "release",
    label: "Didn’t happen — release, no fault",
    confirm: "Release the hold with no fault? The asker isn't charged and the expert isn't paid.",
    style: "border border-line text-ink hover:bg-line/40",
  },
  {
    key: "release_expert_fault",
    label: "Expert didn’t show — release",
    confirm: "Release the hold and record that the expert didn't show?",
    style: "border border-postal-red/30 text-postal-red hover:bg-postal-red/10",
  },
] as const

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—"
}

// Why the system itself held a conversation, from its stored reason.
function systemReasonText(reason: string | null): string {
  switch (reason) {
    case "auto_needs_review":
      return "only the asker opened the join page"
    case "auto_video_no_data":
      return "someone tried to join but no connection data arrived"
    case "auto_video_conflict":
      return "the expert's mark and the connection data disagree"
    case "auto_video_short_call":
      return "both connected, but for under 10 minutes together"
    case "auto_video_connection_failure":
      return "both connected, but for under 2 minutes together (likely a connection failure)"
    case "auto_video_asker_clicked_no_connection":
      return "the asker pressed Join but never connected"
    default:
      return reason ?? "unknown"
  }
}

// "join_link_opened" -> "Join link opened"
function eventLabel(event: string): string {
  const text = event.replace(/_/g, " ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// A short, readable summary of an event's details.
function eventDetail(detail: Record<string, unknown> | null): string {
  if (!detail) return ""
  return Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ")
}

export default function AdminConversationsPage() {
  const [disputes, setDisputes] = useState<Dispute[] | null>(null)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return
      const res = await fetch("/api/admin/follow-up-disputes", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      })
      const json = await res.json().catch(() => null)
      if (cancelled) return
      if (!res.ok) {
        setError(json?.error ?? "Could not load conversations.")
      } else {
        setError("")
        setDisputes(json.disputes)
      }
      setBusyId(null)
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function resolve(id: string, resolution: string) {
    setBusyId(id)
    setError("")
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return
    const res = await fetch("/api/admin/follow-up-resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({ id, resolution }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) setError(json?.error ?? "Could not resolve this conversation.")
    setReloadKey((k) => k + 1)
  }

  if (disputes === null && !error) return <p className="text-ink-soft">Loading...</p>

  return (
    <section>
      <h1 className="font-display text-2xl text-ink">Conversations needing a decision</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Follow-up conversations held for review. If nobody decides, the card
        hold is released automatically about 12 hours before it would lapse.
      </p>

      {error && <p className="mt-4 text-sm text-postal-red">{error}</p>}

      {disputes && disputes.length === 0 && (
        <p className="mt-6 text-sm text-ink-soft">Nothing is waiting for a decision.</p>
      )}

      <div className="mt-6 space-y-4">
        {(disputes ?? []).map((d) => (
          <div key={d.id} className="rounded-lg border border-line bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                {d.referenceId ? `Question #${d.referenceId}` : "Conversation"} · {d.expertName}
              </p>
              <p className="text-sm text-ink">${(d.priceCents / 100).toFixed(2)} held</p>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Scheduled</dt>
                <dd className="text-ink">{fmt(d.confirmedStart)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Reported by</dt>
                <dd className="text-ink">{d.reportedBy ?? `system: ${systemReasonText(d.reason)}`}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Asker opened join page</dt>
                <dd className="text-ink">{fmt(d.askerJoinedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Expert opened join page</dt>
                <dd className="text-ink">{fmt(d.expertJoinedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Reported</dt>
                <dd className="text-ink">{fmt(d.reportedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Hold lapses</dt>
                <dd className="text-ink">{fmt(d.captureBefore)}</dd>
              </div>
            </dl>
            {d.connection && (
              <div className="mt-3 rounded-lg border border-line bg-white p-4">
                <p className="text-sm font-semibold text-ink">Connection (held on DMQ)</p>
                {(["expert", "asker"] as const).map((role) => {
                  const c = d.connection![role]
                  return (
                    <div key={role} className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-ink-soft">
                        {role === "expert" ? "Expert joined" : "Asker joined"}
                      </span>
                      <span className="text-ink">
                        {!c.joined ? "Not joined" : c.connected ? "Still connected" : "Connected, then left"}
                        {c.reconnects > 0 && (
                          <span className="ml-2 text-xs text-ink-soft">
                            {c.reconnects} reconnect{c.reconnects === 1 ? "" : "s"}
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Shared connection time</span>
                  <span className="font-semibold text-ink">{formatDuration(d.connection.sharedSeconds)}</span>
                </div>
                <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
                  Connection data can support troubleshooting and payment reviews, but doesn&apos;t
                  prove the quality of the conversation.
                </p>
              </div>
            )}

            {(d.problemReason || d.problemNote) && (
              <div className="mt-3 rounded-sm bg-line/30 p-3 text-sm text-ink">
                {d.problemReason && (
                  <p className="font-medium">
                    {problemReasonLabel(
                      d.problemReason,
                      d.reportedBy === "expert" ? "expert" : "asker"
                    )}
                  </p>
                )}
                {d.problemNote && (
                  <p className="mt-1 whitespace-pre-wrap text-ink-soft">{d.problemNote}</p>
                )}
              </div>
            )}

            {d.events.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-ink-soft hover:text-ink">
                  Timeline ({d.events.length})
                </summary>
                <ol className="mt-2 space-y-1.5 border-l border-line pl-3">
                  {d.events.map((e, i) => (
                    <li key={i} className="text-xs">
                      <span className="text-ink-soft">{fmt(e.at)}</span>{" "}
                      <span className="font-medium text-ink">{eventLabel(e.event)}</span>{" "}
                      <span className="text-ink-soft">({e.actor})</span>
                      {eventDetail(e.detail) && (
                        <p className="mt-0.5 break-words text-ink-soft">{eventDetail(e.detail)}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </details>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => {
                    if (window.confirm(r.confirm)) resolve(d.id, r.key)
                  }}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-50 ${r.style}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
