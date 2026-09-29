"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type ExpertRow = {
  id: string
  fullName: string
  username: string | null
  avatarUrl: string | null
  email: string | null
  isActive: boolean
  stripeOnboarded: boolean
  questionsReceived: number
  questionsAnswered: number
  expertEarnedCents: number
  dmqEarnedCents: number
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function AdminExpertsPage() {
  const [rows, setRows] = useState<ExpertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError("")

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const res = await fetch("/api/admin/experts-summary", {
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    })
    const data = await res.json()

    if (data.error) {
      setError(data.error)
    } else {
      setRows(data.experts)
    }
    setLoading(false)
  }

  const totals = rows.reduce(
    (acc, r) => ({
      received: acc.received + r.questionsReceived,
      answered: acc.answered + r.questionsAnswered,
      expertEarned: acc.expertEarned + r.expertEarnedCents,
      dmqEarned: acc.dmqEarned + r.dmqEarnedCents,
    }),
    { received: 0, answered: 0, expertEarned: 0, dmqEarned: 0 }
  )

  if (loading) return <p className="text-ink-soft">Loading...</p>
  if (error) return <p className="text-postal-red">{error}</p>

  return (
    <section>
      <h1 className="font-display text-2xl text-ink">Experts</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {rows.length} expert{rows.length === 1 ? "" : "s"} total.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="font-display text-2xl font-semibold text-ink">
            {totals.received}
          </p>
          <p className="text-xs text-ink-soft">Questions received</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="font-display text-2xl font-semibold text-ink">
            {totals.answered}
          </p>
          <p className="text-xs text-ink-soft">Questions answered</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="font-display text-2xl font-semibold text-green-700">
            {formatCents(totals.expertEarned)}
          </p>
          <p className="text-xs text-ink-soft">Paid to experts</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="font-display text-2xl font-semibold text-postal-red">
            {formatCents(totals.dmqEarned)}
          </p>
          <p className="text-xs text-ink-soft">DMQ platform fees</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-card text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Expert</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-3 py-3 text-right font-medium">Received</th>
              <th className="px-3 py-3 text-right font-medium">Answered</th>
              <th className="px-3 py-3 text-right font-medium">
                Expert earned
              </th>
              <th className="px-4 py-3 text-right font-medium">DMQ earned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-soft">
                  No experts yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {r.avatarUrl ? (
                      <img
                        src={r.avatarUrl}
                        alt={r.fullName}
                        className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-line/40 text-xs font-medium text-ink-soft">
                        {r.fullName?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">
                        {r.fullName}
                        {r.username && (
                          <span className="ml-1.5 font-normal text-ink-soft">
                            @{r.username}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-ink-soft">
                        {r.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        r.isActive
                          ? "bg-green-500/10 text-green-700"
                          : "bg-line/40 text-ink-soft"
                      }`}
                    >
                      {r.isActive ? "Active" : "Paused"}
                    </span>
                    {!r.stripeOnboarded && (
                      <span className="inline-flex items-center rounded-full bg-postal-red/10 px-2.5 py-1 text-xs font-medium text-postal-red">
                        No payouts
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-right text-ink">
                  {r.questionsReceived}
                </td>
                <td className="px-3 py-3 text-right text-ink">
                  {r.questionsAnswered}
                </td>
                <td className="px-3 py-3 text-right text-ink">
                  {formatCents(r.expertEarnedCents)}
                </td>
                <td className="px-4 py-3 text-right text-ink">
                  {formatCents(r.dmqEarnedCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
