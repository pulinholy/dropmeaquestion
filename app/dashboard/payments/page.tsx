"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { CheckIcon, CreditCardIcon } from "@/components/icons"

const EXPERT_NET_RATE = 0.85

type Earning = {
  id: string
  question_text: string
  reference_id: string | null
  price_cents: number | null
  answered_at: string | null
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
  const [earnings, setEarnings] = useState<Earning[]>([])
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

    setEarnings(questions ?? [])
    setLoading(false)
  }

  async function connectStripe() {
    setConnectingStripe(true)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`,
    }

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
      const data = await res.json()

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
    const linkData = await linkRes.json()

    window.location.href = linkData.url
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

  const totalNetCents = earnings.reduce(
    (sum, e) => sum + Math.round((e.price_cents ?? 0) * EXPERT_NET_RATE),
    0
  )

  return (
    <section>
      <h1 className="font-display text-xl text-ink">Payments</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Manage your payouts and see your earnings from answered questions.
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
              You receive 85% of every answered question. DMQ&apos;s 15%
              platform fee includes payment processing. Stripe sends your
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
            No answered questions yet — earnings will show up here once you
            answer your first one.
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
                  const gross = e.price_cents ?? 0
                  const net = Math.round(gross * EXPERT_NET_RATE)
                  return (
                    <tr key={e.id}>
                      <td className="max-w-[280px] px-5 py-3 align-top">
                        <p className="truncate font-medium text-ink">
                          {e.question_text}
                        </p>
                        {e.reference_id && (
                          <p className="mt-0.5 truncate text-xs text-ink-soft">
                            Question #{e.reference_id}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top text-ink-soft">
                        {e.answered_at ? formatShortDate(e.answered_at) : "—"}
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
