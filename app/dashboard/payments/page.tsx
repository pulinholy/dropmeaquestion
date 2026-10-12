"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { CheckIcon, CreditCardIcon } from "@/components/icons"

const EXPERT_NET_RATE = 0.85

// One line in the earnings list: an answered question or a paid conversation.
type Earning = {
  id: string
  kind: "question" | "conversation"
  title: string
  reference_id: string | null
  gross_cents: number
  net_cents: number
  date: string | null
}

const CONVERSATION_TITLES: Record<string, string> = {
  completed: "Follow-up conversation",
  late_cancelled: "Follow-up conversation (late cancellation)",
  asker_no_show: "Follow-up conversation (asker didn't join)",
}

function formatShortDate(dateStr: string): string {
  const hasTimezone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(dateStr)
  const date = new Date(hasTimezone ? dateStr : `${dateStr}Z`)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  })
}

export default function PaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [stripeOnboarded, setStripeOnboarded] = useState(false)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [stripeError, setStripeError] = useState("")
  const [earnings, setEarnings] = useState<Earning[]>([])
  // Whether this expert can offer follow-up conversations, so the page can
  // mention them. Hidden for everyone else.
  const [showConversations, setShowConversations] = useState(false)
  const [showPaymentDetails, setShowPaymentDetails] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data: expert } = await supabase
      .from("experts")
      .select("stripe_onboarded, stripe_account_id")
      .eq("id", userId)
      .single()

    if (expert) {
      setStripeOnboarded(expert.stripe_onboarded)
      setStripeAccountId(expert.stripe_account_id)
    }

    const { data: questions } = await supabase
      .from("questions")
      .select("id, question_text, reference_id, price_cents, answered_at")
      .eq("expert_id", userId)
      .eq("status", "answered")
      .order("answered_at", { ascending: false })

    const rows: Earning[] = (questions ?? []).map((q) => ({
      id: q.id,
      kind: "question",
      title: q.question_text,
      reference_id: q.reference_id,
      gross_cents: q.price_cents ?? 0,
      net_cents: Math.round((q.price_cents ?? 0) * EXPERT_NET_RATE),
      date: q.answered_at,
    }))

    // Paid follow-up conversations, from the server. A failure here leaves
    // them out rather than hiding the questions.
    try {
      const res = await fetch("/api/follow-up/earnings", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      })
      if (res.ok) {
        const json = await res.json()
        const paid: {
          id: string
          referenceId: string | null
          outcome: string
          paidAt: string | null
          grossCents: number
          netCents: number
        }[] = json.conversations ?? []
        for (const c of paid) {
          rows.push({
            id: c.id,
            kind: "conversation",
            title: CONVERSATION_TITLES[c.outcome] ?? "Follow-up conversation",
            reference_id: c.referenceId,
            gross_cents: c.grossCents,
            net_cents: c.netCents,
            date: c.paidAt,
          })
        }
        setShowConversations(Boolean(json.available) || paid.length > 0)
      }
    } catch {
      // Ignored: only the questions are listed.
    }

    rows.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
    setEarnings(rows)
    setLoading(false)
  }

  async function connectStripe() {
    setConnectingStripe(true)
    setStripeError("")

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setConnectingStripe(false)
      return
    }

    const userId = sessionData.session.user.id
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`,
    }

    try {
      const { data: expertData } = await supabase
        .from("experts")
        .select("stripe_account_id")
        .eq("id", userId)
        .single()

      let accountId = expertData?.stripe_account_id

      if (!accountId) {
        const res = await fetch("/api/stripe/create-account", {
          method: "POST",
          headers: authHeaders,
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || typeof data?.accountId !== "string") {
          throw new Error(data?.error ?? "Stripe didn't create the account.")
        }
        accountId = data.accountId

        await supabase
          .from("experts")
          .update({ stripe_account_id: accountId })
          .eq("id", userId)
      }

      const linkRes = await fetch("/api/stripe/create-account-link", {
        method: "POST",
        headers: authHeaders,
      })
      const linkData = await linkRes.json().catch(() => null)
      if (!linkRes.ok || typeof linkData?.url !== "string") {
        throw new Error(linkData?.error ?? "Stripe didn't give a setup link.")
      }

      window.location.href = linkData.url
    } catch (err) {
      setStripeError(`We couldn't open Stripe setup: ${(err as Error).message}`)
      setConnectingStripe(false)
    }
  }

  async function openStripeDashboard() {
    if (!stripeAccountId) return
    setConnectingStripe(true)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setConnectingStripe(false)
      return
    }

    const res = await fetch("/api/stripe/create-login-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    })
    const data = await res.json()

    if (data.url) {
      window.open(data.url, "_blank")
    }
    setConnectingStripe(false)
  }

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  const totalNetCents = earnings.reduce((sum, e) => sum + e.net_cents, 0)

  return (
    <section>
      <h1 className="font-display text-xl text-ink">Payments</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Manage your payouts and see your earnings from answered questions
        {showConversations ? " and follow-up conversations" : ""}.
      </p>

      {stripeOnboarded ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-line bg-green-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
              <CheckIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-700">
                Stripe connected
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                You&apos;re set up to receive payments for answered questions.
              </p>
            </div>
          </div>
          <button
            onClick={openStripeDashboard}
            disabled={connectingStripe}
            className="flex-shrink-0 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-line/40 disabled:opacity-50"
          >
            {connectingStripe ? "Opening..." : "Open Stripe dashboard ↗"}
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-line bg-card p-5">
          <p className="text-sm font-semibold text-ink">
            Connect your bank account
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Connect your bank account to get paid for answered questions.
          </p>
          <button
            onClick={connectStripe}
            disabled={connectingStripe}
            className="mt-3 rounded-full bg-postal-red px-5 py-2.5 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
          >
            {connectingStripe ? "Connecting..." : "Connect Stripe to Get Paid"}
          </button>
          {stripeError && <p className="mt-2 text-sm text-postal-red">{stripeError}</p>}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-line bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
            <CreditCardIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">
              How payments work
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              You receive 85% of every answered question
              {showConversations ? " and every paid follow-up conversation" : ""}.
              DMQ&apos;s 15% platform fee includes payment processing. Stripe sends your
              available balance to your bank based on your payout schedule.
            </p>
            <button
              type="button"
              onClick={() => setShowPaymentDetails((s) => !s)}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-postal-blue hover:text-ink"
            >
              {showPaymentDetails
                ? "Hide details"
                : "Learn more about payments"}
              <span
                aria-hidden
                className={`inline-block transition-transform ${showPaymentDetails ? "-rotate-180" : ""}`}
              >
                ↓
              </span>
            </button>

            {showPaymentDetails && (
              <ol className="mt-3 list-decimal space-y-1.5 border-t border-line pl-4 pt-3 text-sm text-ink-soft">
                <li>
                  When someone asks a question, their card is authorized but
                  not charged yet.
                </li>
                <li>
                  If you answer in time, the card is charged and we transfer{" "}
                  <strong className="text-ink">85%</strong> of that charge to
                  your connected Stripe account — we keep a 15% platform fee.
                </li>
                <li>
                  Stripe then pays that balance out to your bank account on
                  its own schedule (commonly every few days, sometimes
                  longer while your account is new).{" "}
                  <strong className="text-ink">
                    The amounts below confirm the money reached your Stripe
                    account — not that it&apos;s in your bank yet.
                  </strong>{" "}
                  Open your Stripe dashboard above for exact payout dates and
                  status.
                </li>
                {showConversations && (
                  <li>
                    Follow-up conversations work the same way: the asker&apos;s
                    card is held when they request one and charged after the
                    conversation takes place, and you receive 85%. A
                    conversation appears below once its payment has been taken.
                  </li>
                )}
              </ol>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-line bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg text-ink">Earnings</h2>
          <div className="flex-shrink-0 text-right">
            <p className="font-display text-2xl font-semibold text-green-700">
              ${(totalNetCents / 100).toFixed(2)}
            </p>
            <p className="text-xs text-ink-soft">Total earned</p>
          </div>
        </div>

        {earnings.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            Nothing earned yet — earnings will show up here once you answer
            your first question{showConversations ? " or hold a paid conversation" : ""}.
          </p>
        ) : (
          <div className="-mx-5 mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-y border-line bg-line/20 text-left text-xs font-medium uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-2 font-medium">Question</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Amount earned
                  </th>
                  <th className="px-5 py-2 text-right font-medium">
                    Original charge
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {earnings.map((e) => {
                  const gross = e.gross_cents
                  const net = e.net_cents
                  return (
                    <tr key={e.id}>
                      <td className="max-w-[280px] px-5 py-3 align-top">
                        <p className="truncate font-medium text-ink">
                          {e.title}
                        </p>
                        {e.reference_id && (
                          <p className="mt-0.5 truncate text-xs text-ink-soft">
                            {e.kind === "conversation" ? "For question" : "Question"} #{e.reference_id}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top text-ink-soft">
                        {e.date ? formatShortDate(e.date) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right align-top">
                        <p className="font-semibold text-green-700">
                          ${(net / 100).toFixed(2)}
                        </p>
                        <p className="text-xs text-ink-soft">Earned</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right align-top">
                        <p className="font-medium text-ink">
                          ${(gross / 100).toFixed(2)}
                        </p>
                        <p className="text-xs text-ink-soft">Charged</p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
