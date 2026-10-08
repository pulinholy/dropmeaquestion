"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { formatResponseWindow } from "@/lib/format"
import { useProfileInfo } from "../profile-context"
import {
  ChatIcon,
  ClockIcon,
  DollarSignIcon,
  TagIcon,
  VideoIcon,
  InfoIcon,
} from "@/components/icons"

const MIN_PRICE = 5
const MIN_FOLLOW_UP_PRICE = 15
const MAX_FOLLOW_UP_PRICE = 100

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
      .select("follow_up_enabled, follow_up_price_cents")
      .eq("id", userId)
      .single()

    if (followUpError || !followUp) {
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

    if (parseFloat(price) < MIN_PRICE) {
      setError(`Minimum question price is $${MIN_PRICE}.`)
      setSaving(false)
      return
    }

    const followUpValue = parseFloat(followUpPrice)
    const followUpPriceValid =
      !isNaN(followUpValue) &&
      followUpValue >= MIN_FOLLOW_UP_PRICE &&
      followUpValue <= MAX_FOLLOW_UP_PRICE
    if (followUpAvailable && followUpEnabled && !followUpPriceValid) {
      setError(
        `Follow-up conversation price must be between $${MIN_FOLLOW_UP_PRICE} and $${MAX_FOLLOW_UP_PRICE}.`
      )
      setSaving(false)
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { error: updateError } = await supabase
      .from("experts")
      .update({
        price_cents: Math.round(parseFloat(price) * 100),
        response_window_hours: parseInt(responseWindowHours, 10),
      })
      .eq("id", userId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    if (followUpAvailable) {
      const { error: followUpError } = await supabase
        .from("experts")
        .update({
          follow_up_enabled: followUpEnabled,
          // Keep a valid price on file even while switched off, so turning it
          // back on remembers it.
          follow_up_price_cents: followUpPriceValid
            ? Math.round(followUpValue * 100)
            : null,
        })
        .eq("id", userId)

      if (followUpError) {
        setError(followUpError.message)
        setSaving(false)
        return
      }
    }

    setSaved(true)
    setSaving(false)
  }

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  const priceValue = parseFloat(price)
  const hasValidPrice = !isNaN(priceValue) && priceValue > 0
  const netEarnings = hasValidPrice ? (priceValue * 0.85).toFixed(2) : "0.00"
  const displayPrice = hasValidPrice ? priceValue.toFixed(2) : "0.00"

  return (
    <section>
      <Link href="/dashboard" className="text-sm text-ink-soft hover:text-ink">
        ← Back to home
      </Link>

      <h1 className="mt-2 font-display text-xl text-ink">
        Pricing &amp; response time
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Set how much you charge for a question and how quickly you&apos;ll
        respond. You can change these anytime.
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
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="min-w-0 flex-1 border-0 p-0 text-sm text-ink focus:outline-none focus:ring-0"
                  />
                  <span className="flex-shrink-0 text-sm text-ink-soft">
                    USD
                  </span>
                </div>

                <div className="mt-3 flex items-start gap-3 rounded-lg bg-green-500/10 p-3">
                  <DollarSignIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-700" />
                  <p className="text-xs text-ink">
                    <span className="font-semibold text-green-700">
                      You receive ${netEarnings}
                    </span>{" "}
                    after DMQ&apos;s 15% platform fee.
                    <br />
                    Payment processing is included.
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
                    Give askers the option to request a paid 15-minute conversation
                    after receiving your answer.
                  </p>
                </div>
              </div>

              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/30">
                <input
                  type="checkbox"
                  checked={followUpEnabled}
                  onChange={(e) => setFollowUpEnabled(e.target.checked)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                    followUpEnabled ? "bg-ink text-white" : "border-2 border-line"
                  }`}
                >
                  {followUpEnabled && (
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3.5 8.5l3 3 6-6.5" />
                    </svg>
                  )}
                </span>
                <span className="text-base text-ink">
                  Offer 15-minute follow-up conversations
                </span>
              </label>

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
                      type="number"
                      min={MIN_FOLLOW_UP_PRICE}
                      max={MAX_FOLLOW_UP_PRICE}
                      step="0.01"
                      value={followUpPrice}
                      onChange={(e) => setFollowUpPrice(e.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-ink focus:outline-none focus:ring-0"
                    />
                    <span className="flex-shrink-0 text-xs text-ink-soft">USD</span>
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">
                    Set a price between ${MIN_FOLLOW_UP_PRICE} and ${MAX_FOLLOW_UP_PRICE}.
                  </p>

                  {!isNaN(parseFloat(followUpPrice)) &&
                    parseFloat(followUpPrice) >= MIN_FOLLOW_UP_PRICE &&
                    parseFloat(followUpPrice) <= MAX_FOLLOW_UP_PRICE && (
                      <div className="mt-4 px-1">
                        <div className="flex items-baseline justify-between gap-4">
                          <p className="text-sm font-medium text-ink">You receive</p>
                          <p className="text-lg font-semibold text-ink">
                            ${(parseFloat(followUpPrice) * 0.85).toFixed(2)}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-ink-soft">
                          After DMQ&apos;s 15% platform fee. Payment processing included.
                        </p>
                      </div>
                    )}
                </div>
              )}

              <p className="mt-4 flex items-center gap-2 text-xs text-ink-soft">
                <InfoIcon className="h-3.5 w-3.5 flex-shrink-0" />
                You&apos;ll confirm each request and provide a meeting link.
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
                    Askers receive the invitation in the email that delivers your
                    written answer. It isn&apos;t shown on your public page.
                  </li>
                  <li>
                    Askers propose up to three times. You confirm one within 24
                    hours and add your own Zoom or Google Meet link. A new link
                    per call, with a waiting room turned on, is best.
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
                    Your email address isn&apos;t shared by Drop Me A Question.
                    Your meeting service may show your display name.
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
              disabled={saving}
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
                    ${displayPrice}
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
                    <span className="text-ink">${displayPrice}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-soft">You receive</span>
                    <span className="font-semibold text-ink">
                      ${netEarnings}
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
