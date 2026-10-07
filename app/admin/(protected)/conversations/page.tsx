"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Dispute = {
  id: string
  referenceId: string | null
  expertName: string
  priceCents: number
  confirmedStart: string | null
  captureBefore: string | null
  reportedAt: string | null
  reportedBy: string | null
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
    label: "Expert didn’t show — release + strike",
    confirm: "Release the hold and count a strike against the expert?",
    style: "border border-postal-red/30 text-postal-red hover:bg-postal-red/10",
  },
] as const

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—"
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
                <dd className="text-ink">{d.reportedBy ?? "system (only the asker joined)"}</dd>
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
