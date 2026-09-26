"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useQuestionCounts } from "./questions-context"
import { useProfileInfo } from "./profile-context"
import {
  ChatIcon,
  CheckIcon,
  ClockIcon,
  CreditCardIcon,
  DollarSignIcon,
  LinkIcon,
  MegaphoneIcon,
} from "@/components/icons"

const EXPERT_NET_RATE = 0.85

const growthTips = [
  "Share your link on social media, email, or your website",
  "Keep your profile and topics up to date",
  "Respond to questions within your selected time",
]

type Stats = {
  totalEarnedCents: number
}

type ActivityEvent = {
  id: string
  date: string
  label: string
  amountCents: number | null
}

// Supabase returns timestamp (no timezone) columns without a "Z" suffix,
// which the Date constructor would otherwise parse as local time instead
// of UTC. Force UTC interpretation when no timezone is present.
function formatEventDate(dateStr: string): string {
  const hasTimezone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(dateStr)
  const date = new Date(hasTimezone ? dateStr : `${dateStr}Z`)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function DashboardHomePage() {
  const { counts } = useQuestionCounts()
  const { profile } = useProfileInfo()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([])
  const [stripeOnboarded, setStripeOnboarded] = useState(true)
  const [stripeStatusLoaded, setStripeStatusLoaded] = useState(false)
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [showPaymentDetails, setShowPaymentDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadStats()
    loadStripeStatus()
    loadRecentActivity()
  }, [])

  async function loadStats() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data } = await supabase
      .from("questions")
      .select("price_cents")
      .eq("expert_id", userId)
      .eq("status", "answered")

    const rows = data ?? []
    const totalEarnedCents = rows.reduce((sum, q) => sum + Math.round((q.price_cents ?? 0) * EXPERT_NET_RATE), 0)

    setStats({ totalEarnedCents })
  }

  async function loadRecentActivity() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data } = await supabase
      .from("questions")
      .select("id, created_at, answered_at, price_cents")
      .eq("expert_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)

    const events: ActivityEvent[] = []
    ;(data ?? []).forEach((q) => {
      events.push({
        id: `${q.id}-received`,
        date: q.created_at,
        label: "Question received",
        amountCents: null,
      })
      if (q.answered_at) {
        events.push({
          id: `${q.id}-answered`,
          date: q.answered_at,
          label: "Answer submitted",
          amountCents: Math.round((q.price_cents ?? 0) * EXPERT_NET_RATE),
        })
      }
    })

    events.sort((a, b) => b.date.localeCompare(a.date))
    setRecentActivity(events.slice(0, 5))
  }

  async function loadStripeStatus() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data } = await supabase
      .from("experts")
      .select("stripe_onboarded")
      .eq("id", userId)
      .single()

    if (data) setStripeOnboarded(data.stripe_onboarded)
    setStripeStatusLoaded(true)
  }

  async function connectStripe() {
    setConnectingStripe(true)
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setConnectingStripe(false)
      return
    }

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

  async function copyLink() {
    if (!profile.username) return
    await navigator.clipboard.writeText(`${window.location.origin}/${profile.username}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const firstName = profile.fullName?.split(" ")[0] || profile.fullName
  const onboardingComplete = stripeStatusLoaded && stripeOnboarded

  return (
    <section>
      <h1 className="font-display text-2xl text-ink">
        Welcome{firstName ? `, ${firstName}` : ""} 👋
      </h1>
      <p className="mt-1 text-ink-soft">
        {!stripeStatusLoaded
          ? "Loading your dashboard..."
          : onboardingComplete
            ? "Your page is live. Share your link to start receiving questions."
            : "Your page is ready. Complete these steps to start receiving questions."}
      </p>

      {stripeStatusLoaded && !onboardingComplete && (
        <div className="mt-6 rounded-lg border border-line bg-card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg text-ink">Get your page ready</h2>
            <span className="text-sm text-ink-soft">2 of 3 complete</span>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-line/50">
            <div className="h-1.5 w-2/3 rounded-full bg-green-500" />
          </div>

          <ul className="mt-4 space-y-3">
            <li className="flex items-center gap-3 text-sm">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-paper">
                <CheckIcon className="h-3 w-3" />
              </span>
              <div>
                <p className="text-ink">Create your page</p>
                <p className="text-xs text-ink-soft">Your account and page link are set up.</p>
              </div>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-paper">
                <CheckIcon className="h-3 w-3" />
              </span>
              <div>
                <p className="text-ink">Add your expertise</p>
                <p className="text-xs text-ink-soft">Your profile information has been added.</p>
              </div>
            </li>
            <li className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-line text-xs text-ink-soft">
                  3
                </span>
                <div>
                  <p className="text-ink">Connect payouts</p>
                  <p className="text-xs text-ink-soft">Connect your Stripe account to receive earnings.</p>
                </div>
              </div>
              <button
                onClick={connectStripe}
                disabled={connectingStripe}
                className="flex-shrink-0 rounded-full bg-postal-red px-4 py-1.5 text-xs font-medium text-paper hover:bg-ink disabled:opacity-50"
              >
                {connectingStripe ? "Connecting..." : "Connect Stripe"}
              </button>
            </li>
          </ul>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/dashboard/questions/pending"
          className="rounded-lg border border-line bg-card p-4 hover:border-postal-blue/40"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
            <ChatIcon className="h-4 w-4" />
          </div>
          <p className="mt-2 font-display text-2xl text-ink">{counts.pending}</p>
          <p className="text-sm text-ink-soft">Pending questions</p>
          <p className="mt-1 text-xs text-ink-soft/70">
            Questions waiting for your response.
          </p>
        </Link>
        <Link
          href="/dashboard/questions/answered"
          className="rounded-lg border border-line bg-card p-4 hover:border-green-500/40"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 text-green-700">
            <CheckIcon className="h-4 w-4" />
          </div>
          <p className="mt-2 font-display text-2xl text-ink">{counts.answered}</p>
          <p className="text-sm text-ink-soft">Answered questions</p>
          <p className="mt-1 text-xs text-ink-soft/70">
            {counts.answered > 0
              ? `Great work! You've answered ${counts.answered} question${counts.answered === 1 ? "" : "s"}.`
              : "Your answered questions will show up here."}
          </p>
        </Link>
        <Link
          href="/dashboard/payments"
          className="rounded-lg border border-line bg-card p-4 hover:border-postal-red/40"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-postal-red/10 text-postal-red">
            <DollarSignIcon className="h-4 w-4" />
          </div>
          <p className="mt-2 font-display text-2xl text-ink">
            ${((stats?.totalEarnedCents ?? 0) / 100).toFixed(2)}
          </p>
          <p className="text-sm text-ink-soft">Total earnings</p>
          <p className="mt-1 text-xs text-ink-soft/70">
            Your earnings will be transferred to your bank account via
            Stripe.
          </p>
        </Link>
      </div>

      {stripeStatusLoaded && !onboardingComplete && (
        <div className="mt-6 rounded-lg border border-line bg-card p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
              <CreditCardIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg text-ink">
                Get paid for your answers
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                Connect your Stripe account so we can send your earnings
                directly to you.
              </p>
              <ul className="mt-3 space-y-1.5">
                {[
                  "You keep 85% of every answered question",
                  "DMQ covers all payment processing fees",
                  "Takes about 2 minutes to set up",
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-center gap-2 text-sm text-ink-soft"
                  >
                    <CheckIcon className="h-3.5 w-3.5 flex-shrink-0 text-postal-red" />
                    {line}
                  </li>
                ))}
              </ul>

              <button
                onClick={connectStripe}
                disabled={connectingStripe}
                className="mt-4 rounded-full bg-postal-red px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink disabled:opacity-50"
              >
                {connectingStripe ? "Connecting..." : "Connect Stripe"}
              </button>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentDetails((s) => !s)}
                  className="text-sm font-medium text-postal-blue underline decoration-line underline-offset-4 hover:text-ink"
                >
                  {showPaymentDetails ? "Hide" : "How payments work"} →
                </button>
              </div>

              {showPaymentDetails && (
                <ol className="mt-3 list-decimal space-y-1.5 border-t border-line pt-3 pl-4 text-sm text-ink-soft">
                  <li>
                    When someone asks a question, their card is authorized
                    but not charged yet.
                  </li>
                  <li>
                    If you answer in time, the card is charged and we
                    transfer <strong className="text-ink">85%</strong> of
                    that charge to your connected Stripe account.
                  </li>
                  <li>
                    Stripe then pays that balance out to your bank account
                    on its own schedule (commonly every few days).
                  </li>
                </ol>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-line bg-card p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-700">
                <LinkIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-lg text-ink">Your page</p>
                <p className="text-sm text-ink-soft">
                  Share your unique link to let people ask you questions.
                </p>
              </div>
            </div>
            {profile.username && (
              <div className="mt-4 flex items-center gap-2">
                <div className="truncate rounded-sm border border-line bg-line/20 px-3 py-2 text-sm text-ink-soft">
                  dropmeaquestion.com/{profile.username}
                </div>
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 rounded-sm border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-line/40"
                >
                  {copied ? "Copied!" : "Copy link"}
                </button>
              </div>
            )}
          </div>
          {profile.username && (
            <a
              href={`/${profile.username}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-shrink-0 items-center justify-center gap-1 rounded-full bg-postal-red px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink"
            >
              View my page <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-lavender/40 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
              <MegaphoneIcon className="h-5 w-5" />
            </div>
            <h2 className="font-display text-lg text-ink">
              Keep getting questions
            </h2>
          </div>
          <ul className="mt-4 space-y-2">
            {growthTips.map((tip) => (
              <li
                key={tip}
                className="flex items-start gap-2 text-sm text-ink-soft"
              >
                <CheckIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                {tip}
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/get-more-questions"
            className="mt-4 inline-block text-sm font-medium text-postal-blue hover:text-ink"
          >
            See how to get more questions →
          </Link>
        </div>

        <div className="rounded-lg border border-line bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
                <ClockIcon className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg text-ink">
                Recent activity
              </h2>
            </div>
            <Link
              href="/dashboard/questions/answered"
              className="text-sm font-medium text-postal-blue hover:text-ink"
            >
              View all →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Your activity will show up here once someone asks you a
                question.
              </p>
            ) : (
              recentActivity.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-ink-soft">
                      {formatEventDate(event.date)}
                    </p>
                    <p className="text-ink">{event.label}</p>
                  </div>
                  <p
                    className={`flex-shrink-0 font-medium ${
                      event.amountCents ? "text-green-700" : "text-ink-soft"
                    }`}
                  >
                    {event.amountCents
                      ? `$${(event.amountCents / 100).toFixed(2)}`
                      : "—"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
