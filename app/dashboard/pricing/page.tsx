"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { formatResponseWindow } from "@/lib/format"
import {
  QUESTION_PRICE_MAX,
  QUESTION_PRICE_MIN,
  FOLLOW_UP_PRICE_MAX,
  FOLLOW_UP_PRICE_MIN,
  checkFollowUpPrice,
  checkQuestionPrice,
  expertNetDollars,
  onlyPriceDigits,
} from "@/lib/pricing"
import { useProfileInfo } from "../profile-context"
import {
  ChatIcon,
  ClockIcon,
  DollarSignIcon,
  TagIcon,
  VideoIcon,
  InfoIcon,
} from "@/components/icons"


const responseOptions = [
  { hours: 12, label: "Within 12 hours" },
  { hours: 24, label: "Within 24 hours" },
  { hours: 48, label: "Within 48 hours" },
]

// Rotating background tints for topic pills -- matches the public profile
// page and the dashboard Profile preview.
const TOPIC_STYLES = ["bg-lavender/60", "bg-postal-blue/10", "bg-line/50"]

export default function PricingPage() {
  const { profile } = useProfileInfo()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [price, setPrice] = useState("10")
  const [responseWindowHours, setResponseWindowHours] = useState("24")
  const [headline, setHeadline] = useState("")
  const [topics, setTopics] = useState<string[]>([])
  // Follow-up conversations are read separately so that, before the database
  // has the new columns, this page keeps working and just hides the section.
  const [followUpAvailable, setFollowUpAvailable] = useState(false)
  const [followUpEnabled, setFollowUpEnabled] = useState(false)
  const [followUpPrice, setFollowUpPrice] = useState("35")
  const [showFollowUpDetails, setShowFollowUpDetails] = useState(false)
  // Set once Save is pressed (or a price is typed), so an empty box isn't
  // scolded before the person has had a go.
  const [tried, setTried] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError("")
    setSaved(false)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data: expert } = await supabase
      .from("experts")
      .select("price_cents, response_window_hours, headline")
      .eq("id", userId)
      .single()

    if (expert) {
      setPrice((expert.price_cents / 100).toString())
      setResponseWindowHours(String(expert.response_window_hours))
      setHeadline(expert.headline ?? "")
    }

    const { data: topicsData } = await supabase
      .from("expert_topics")
      .select("name")
      .eq("expert_id", userId)
      .order("sort_order", { ascending: true })

    setTopics(topicsData?.map((t) => t.name) ?? [])

    const { data: followUp, error: followUpError } = await supabase
      .from("experts")
      .select("follow_up_allowed, follow_up_enabled, follow_up_price_cents")
      .eq("id", userId)
      .single()

    // Private beta: only experts an admin has allowed see the section.
    if (followUpError || !followUp || !followUp.follow_up_allowed) {
      setFollowUpAvailable(false)
    } else {
      setFollowUpAvailable(true)
      setFollowUpEnabled(followUp.follow_up_enabled)
      if (followUp.follow_up_price_cents) {
        setFollowUpPrice((followUp.follow_up_price_cents / 100).toString())
      }
    }
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError("")

    setTried(true)
    const priceCheck = checkQuestionPrice(price)
    if (!priceCheck.ok) {
      setError(priceCheck.message)
      setSaving(false)
      return
    }
    const followUpCheck = checkFollowUpPrice(followUpPrice)
    if (followUpAvailable && followUpEnabled && !followUpCheck.ok) {
      setError(followUpCheck.message)
      setSaving(false)
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    try {
      const res = await fetch("/api/save-pricing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          price,
          responseWindowHours: parseInt(responseWindowHours, 10),
          followUp: followUpAvailable ? { enabled: followUpEnabled, price: followUpPrice } : null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not save your pricing. Please try again.")
        setSaving(false)
        return
      }
    } catch {
      setError("Could not save your pricing. Please try again.")
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
  }

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  // Everything below is worked out from what is in the boxes right now, never
  // from a price typed earlier or from what was last saved.
  const priceCheck = checkQuestionPrice(price)
  const followUpCheck = checkFollowUpPrice(followUpPrice)
  const showPriceError = !priceCheck.ok && (tried || price !== "")
  const showFollowUpError = !followUpCheck.ok && (tried || followUpPrice !== "")
  const canSave = priceCheck.ok && !(followUpAvailable && followUpEnabled && !followUpCheck.ok)

  return (
    <section>
      <Link href="/dashboard" className="text-sm text-ink-soft hover:text-ink">
        ← Back to home
      </Link>

      <h1 className="mt-2 font-display text-xl text-ink">
        Pricing &amp; response time
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        {followUpAvailable
          ? "Set your prices, response time, and optional follow-up conversations. You can change these anytime."
          : "Set how much you charge for a question and how quickly you'll respond. You can change these anytime."}
      </p>

      <form
        onSubmit={handleSave}
        className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[65fr_35fr]"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-lg border border-line bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-700">
                <TagIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-ink">
                  Price per question
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Set a price you&apos;re comfortable with. People will see
                  this on your page.
                </p>

                <div className="mt-3 flex items-center rounded-sm border border-line px-3 py-2">
                  <span className="flex-shrink-0 text-sm text-ink-soft">$</span>
                  <span className="mx-2.5 h-5 w-px flex-shrink-0 bg-line" />
                  <input
                    id="question-price"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="off"
                    aria-label="Price per question in dollars"
                    aria-invalid={showPriceError}
                    aria-describedby="question-price-help"
                    value={price}
                    onChange={(e) => {
                      setPrice(onlyPriceDigits(e.target.value))
                      setSaved(false)
                    }}
                    className="min-w-0 flex-1 border-0 p-0 text-sm text-ink focus:outline-none focus:ring-0"
                  />
                  <span className="flex-shrink-0 text-sm text-ink-soft">
                    USD
                  </span>
                </div>
                <p
                  id="question-price-help"
                  className={`mt-1.5 text-xs ${showPriceError ? "text-postal-red" : "text-ink-soft"}`}
                >
                  {showPriceError && !priceCheck.ok
                    ? priceCheck.message
                    : `Whole dollars only, from $${QUESTION_PRICE_MIN} to $${QUESTION_PRICE_MAX}.`}
                </p>

                <div className="mt-3 flex items-start gap-3 rounded-lg bg-green-500/10 p-3">
                  <DollarSignIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-700" />
                  <p className="text-xs text-ink">
                    {priceCheck.ok ? (
                      <>
                        <span className="font-semibold text-green-700">
                          You receive ${expertNetDollars(priceCheck.dollars)}
                        </span>{" "}
                        after DMQ&apos;s 15% platform fee.
                        <br />
                        Payment processing is included.
                      </>
                    ) : (
                      <>Enter a valid price to see what you would receive.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
                <ClockIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-ink">
                  Response time
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Choose how quickly people can expect your answer.
                </p>

                <select
                  value={responseWindowHours}
                  onChange={(e) => setResponseWindowHours(e.target.value)}
                  className="mt-3 w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
                >
                  {responseOptions.map((option) => (
                    <option key={option.hours} value={option.hours}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-ink-soft">
                  Choose a timeframe you can consistently meet.
                </p>
              </div>
            </div>
          </div>

          {followUpAvailable && (
            <div className="rounded-lg border border-line bg-card p-5">
              <div className="flex items-start gap-3">
                <VideoIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-ink">
                    Follow-up conversations
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    After answering a question, you can invite the asker to a paid
                    15-minute follow-up conversation.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 border-t border-line pt-4">
                <span id="follow-up-switch-label" className="text-sm font-semibold text-ink">
                  Offer 15-minute follow-up conversations
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={followUpEnabled}
                  aria-labelledby="follow-up-switch-label"
                  onClick={() => setFollowUpEnabled((on) => !on)}
                  className={`relative inline-flex h-7 w-[3.75rem] flex-shrink-0 items-center rounded-full text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
                    followUpEnabled ? "bg-green-600 text-white" : "bg-line text-ink-soft"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute ${followUpEnabled ? "left-2.5" : "right-2.5"}`}
                  >
                    {followUpEnabled ? "On" : "Off"}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`absolute h-5 w-5 rounded-full bg-white shadow transition-all ${
                      followUpEnabled ? "right-1" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {followUpEnabled && (
                <div className="mt-4">
                  <label
                    htmlFor="follow-up-price"
                    className="text-sm font-semibold text-ink-soft"
                  >
                    Price per conversation
                  </label>
                  <div className="mt-2 flex items-center rounded-lg border border-line bg-white px-4 py-3.5">
                    <span className="flex-shrink-0 text-base text-ink">$</span>
                    <input
                      id="follow-up-price"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoComplete="off"
                      aria-invalid={showFollowUpError}
                      aria-describedby="follow-up-price-help"
                      value={followUpPrice}
                      onChange={(e) => {
                        setFollowUpPrice(onlyPriceDigits(e.target.value))
                        setSaved(false)
                      }}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-ink focus:outline-none focus:ring-0"
                    />
                    <span className="flex-shrink-0 text-xs text-ink-soft">USD</span>
                  </div>
                  <p
                    id="follow-up-price-help"
                    className={`mt-2 text-xs ${showFollowUpError ? "text-postal-red" : "text-ink-soft"}`}
                  >
                    {showFollowUpError && !followUpCheck.ok
                      ? followUpCheck.message
                      : `Whole dollars only, from $${FOLLOW_UP_PRICE_MIN} to $${FOLLOW_UP_PRICE_MAX}.`}
                  </p>

                  {followUpCheck.ok && (
                    <div className="mt-4 flex items-baseline justify-between gap-4 px-1">
                      <p className="text-sm text-ink-soft">
                        You receive after the 15% platform fee
                      </p>
                      <p className="text-lg font-semibold text-ink">
                        ${expertNetDollars(followUpCheck.dollars)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <p className="mt-4 flex items-center gap-2 text-xs text-ink-soft">
                <InfoIcon className="h-3.5 w-3.5 flex-shrink-0" />
                You&apos;ll review each request and confirm a time. Conversations take
                place on Drop Me A Question.
              </p>

              <button
                type="button"
                onClick={() => setShowFollowUpDetails((open) => !open)}
                aria-expanded={showFollowUpDetails}
                aria-controls="follow-up-details"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink underline decoration-ink underline-offset-4"
              >
                How follow-up conversations work
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className={`h-3 w-3 transition-transform ${showFollowUpDetails ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6l5 5 5-5" />
                </svg>
              </button>

              {showFollowUpDetails && (
                <ul id="follow-up-details" className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
                  <li>
                    You choose, answer by answer, whether to invite the asker. The
                    invitation comes in the email that delivers your written
                    answer, and your public page mentions that you may offer it.
                  </li>
                  <li>
                    Askers propose up to three times. You confirm one within 24
                    hours. The conversation takes place on Drop Me A Question as
                    an audio call with an optional camera, so there is no link to
                    send.
                  </li>
                  <li>
                    Askers can cancel free up to 24 hours before the confirmed
                    call. Later cancellations or asker no-shows are charged in
                    full. If you cancel or don&apos;t show up, the asker isn&apos;t
                    charged.
                  </li>
                  <li>
                    After the call, the asker is asked to confirm it took
                    place. You&apos;re paid when they do, or automatically about
                    a day after the call if no problem is reported. If they
                    report one, we hold the payment and review it.
                  </li>
                  <li>
                    Your email address isn&apos;t shared by Drop Me A Question. You
                    appear under your profile name and the asker appears as Guest.
                    Conversations aren&apos;t recorded.
                  </li>
                  <li>
                    The 15% platform fee covers payment processing, so what you see
                    as &quot;You receive&quot; is what you are paid.
                  </li>
                </ul>
              )}
            </div>
          )}

          {error && <p className="text-sm text-postal-red">{error}</p>}
          {saved && <p className="text-sm text-postal-blue">Saved.</p>}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving || !canSave}
              className="rounded-full bg-postal-red px-6 py-2.5 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={load}
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-line bg-card p-4">
            <h2 className="text-sm font-semibold text-ink">
              What askers will see
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              This is a live preview of how your pricing and response time
              will appear on your page.
            </p>

            <div className="mt-3 overflow-hidden rounded-lg border border-line">
              <div className="h-16 bg-gradient-to-r from-postal-red/20 via-lavender to-postal-blue/10" />
              <div className="bg-card px-4 pb-5 text-center">
                <div className="mx-auto -mt-8 flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-lavender/40">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.fullName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-medium text-ink-soft">
                      {profile.fullName.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-display text-base font-semibold text-ink">
                  {profile.fullName || "Your Name"}
                </p>
                {headline && <p className="text-sm text-ink-soft">{headline}</p>}

                {topics.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                    {topics.map((topic, i) => (
                      <span
                        key={topic}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium text-ink ${TOPIC_STYLES[i % TOPIC_STYLES.length]}`}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 border-t border-line pt-3">
                  <p className="font-display text-2xl font-semibold text-ink">
                    {priceCheck.ok ? `$${priceCheck.dollars}` : "—"}
                  </p>
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
                    <ClockIcon className="h-3.5 w-3.5" />
                    per question &middot; Replies within{" "}
                    {formatResponseWindow(parseInt(responseWindowHours, 10))}
                  </p>
                </div>

                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-postal-red px-4 py-2 text-xs font-medium text-white">
                  <ChatIcon className="h-3.5 w-3.5" />
                  Drop me a question →
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                <DollarSignIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-ink">
                  How your earnings work
                </h3>
                <p className="mt-1 text-xs text-ink-soft">
                  You keep 85% of every answered question. DMQ&apos;s 15%
                  platform fee includes payment processing.
                </p>

                <div className="mt-3 space-y-1.5 rounded-sm border border-line p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-soft">Question price</span>
                    <span className="text-ink">{priceCheck.ok ? `$${priceCheck.dollars}` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-soft">You receive</span>
                    <span className="font-semibold text-ink">
                      {priceCheck.ok ? `$${expertNetDollars(priceCheck.dollars)}` : "—"}
                    </span>
                  </div>
                </div>

                <Link
                  href="/dashboard/payments"
                  className="mt-3 inline-block text-xs font-medium text-postal-blue hover:text-ink"
                >
                  Learn about payments →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>
    </section>
  )
}
