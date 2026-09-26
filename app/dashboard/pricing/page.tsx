"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { formatResponseWindow } from "@/lib/format"
import { useProfileInfo } from "../profile-context"
import { ChatIcon, ClockIcon, DollarSignIcon, TagIcon } from "@/components/icons"

const MIN_PRICE = 5

const responseOptions = [
  { hours: 12, label: "Within 12 hours" },
  { hours: 24, label: "Within 24 hours" },
  { hours: 48, label: "Within 48 hours" },
  { hours: 72, label: "Within 3 days" },
  { hours: 168, label: "Within 7 days" },
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
    } else {
      setSaved(true)
    }
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
                  <p className="text-xs text-ink-soft">per question</p>
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Replies within{" "}
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
