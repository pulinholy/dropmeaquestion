"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Earning = {
  id: string
  question_text: string
  asker_email: string
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

function truncateEmail(email: string, maxLocalLength = 15): string {
  const [local, domain] = email.split("@")
  if (!domain || local.length <= maxLocalLength) return email
  return `${local.slice(0, maxLocalLength)}...@${domain}`
}

export default function PaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [stripeOnboarded, setStripeOnboarded] = useState(false)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [earnings, setEarnings] = useState<Earning[]>([])

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
      .select("id, question_text, asker_email, price_cents, answered_at")
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
    const userEmail = sessionData.session.user.email

    const { data: expertData } = await supabase
      .from("experts")
      .select("stripe_account_id")
      .eq("id", userId)
      .single()

    let accountId = expertData?.stripe_account_id

    if (!accountId) {
      const res = await fetch("/api/stripe/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    })
    const linkData = await linkRes.json()

    window.location.href = linkData.url
  }

  async function openStripeDashboard() {
    if (!stripeAccountId) return
    setConnectingStripe(true)

    const res = await fetch("/api/stripe/create-login-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: stripeAccountId }),
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
    (sum, e) => sum + Math.round((e.price_cents ?? 0) * 0.9),
    0
  )

  return (
    <div className="max-w-lg">
      {stripeOnboarded ? (
        <div className="rounded-sm border border-line p-4">
          <p className="text-sm font-medium text-ink">Stripe connected</p>
          <p className="mt-1 text-sm text-ink-soft">
            You&apos;re set up to get paid for answered questions.
          </p>
          <button
            onClick={openStripeDashboard}
            disabled={connectingStripe}
            className="mt-3 rounded-sm border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-line disabled:opacity-50"
          >
            {connectingStripe ? "Opening..." : "Open Stripe dashboard →"}
          </button>
        </div>
      ) : (
        <div className="rounded-sm border border-postal-red bg-postal-red/5 p-4">
          <p className="text-sm text-ink">
            Connect your bank account to get paid for answered questions.
          </p>
          <button
            onClick={connectStripe}
            disabled={connectingStripe}
            className="mt-3 rounded-sm bg-postal-red px-4 py-2 text-sm font-medium text-paper hover:bg-ink disabled:opacity-50"
          >
            {connectingStripe ? "Connecting..." : "Connect Stripe to Get Paid"}
          </button>
        </div>
      )}

      <div className="mt-6 rounded-sm border border-line bg-lavender p-4 text-sm text-ink">
        <p className="font-medium">How payments work</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-ink-soft">
          <li>
            When someone asks a question, their card is authorized but not
            charged yet.
          </li>
          <li>
            If you answer in time, the card is charged and we transfer{" "}
            <strong className="text-ink">90%</strong> of that charge to your
            connected Stripe account — we keep a 10% platform fee. That
            transfer is what shows as &quot;Earned&quot; below.
          </li>
          <li>
            Stripe then pays that balance out to your bank account on its own
            schedule (commonly every few days, sometimes longer while your
            account is new).{" "}
            <strong className="text-ink">
              The amounts below confirm the money reached your Stripe
              account — not that it&apos;s in your bank yet.
            </strong>{" "}
            Open your Stripe dashboard above for exact payout dates and
            status.
          </li>
        </ol>
      </div>

      <div className="mt-8">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-lg text-ink">Earnings</h3>
          <p className="text-sm text-ink-soft">
            Total transferred:{" "}
            <span className="font-medium text-ink">
              ${(totalNetCents / 100).toFixed(2)}
            </span>
          </p>
        </div>

        <div className="mt-3 space-y-2">
          {earnings.length === 0 && (
            <p className="text-sm text-ink-soft">
              No answered questions yet — earnings will show up here once you
              answer your first one.
            </p>
          )}

          {earnings.map((e) => {
            const gross = e.price_cents ?? 0
            const net = Math.round(gross * 0.9)
            return (
              <div
                key={e.id}
                className="flex items-center justify-between gap-4 rounded-sm border border-line p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{e.question_text}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {truncateEmail(e.asker_email)}
                    {e.answered_at && ` · ${formatShortDate(e.answered_at)}`}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-medium text-ink">
                    ${(net / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    of ${(gross / 100).toFixed(2)} charged
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
