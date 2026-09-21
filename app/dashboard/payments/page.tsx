"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function PaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [stripeOnboarded, setStripeOnboarded] = useState(false)
  const [connectingStripe, setConnectingStripe] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data: expert } = await supabase
      .from("experts")
      .select("stripe_onboarded")
      .eq("id", userId)
      .single()

    if (expert) setStripeOnboarded(expert.stripe_onboarded)
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

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  return (
    <div className="max-w-md">
      {stripeOnboarded ? (
        <div className="rounded-sm border border-line p-4">
          <p className="text-sm font-medium text-ink">Stripe connected</p>
          <p className="mt-1 text-sm text-ink-soft">
            You&apos;re set up to get paid for answered questions.
          </p>
          <button
            onClick={connectStripe}
            disabled={connectingStripe}
            className="mt-3 rounded-sm border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-line disabled:opacity-50"
          >
            {connectingStripe ? "Opening..." : "Manage Stripe account"}
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
    </div>
  )
}
