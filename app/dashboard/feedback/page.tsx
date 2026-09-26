"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  ChatIcon,
  LightbulbIcon,
  ListIcon,
  DocumentIcon,
  PersonIcon,
} from "@/components/icons"

type FeedbackRow = {
  id: string
  question_text: string
  feedback_rating: "up" | "down"
  feedback_comment: string | null
  feedback_submitted_at: string
}

type FilterValue = "all" | "up" | "down"
type SortValue = "newest" | "oldest"

const tips = [
  {
    icon: ChatIcon,
    title: "Ask clarifying questions",
    description: "Make sure you fully understand the asker's specific needs.",
  },
  {
    icon: ListIcon,
    title: "Provide clear, actionable steps",
    description: "Step-by-step guidance is often the most helpful.",
  },
  {
    icon: DocumentIcon,
    title: "Include relevant examples",
    description:
      "Real-world examples and references can make your answer more valuable.",
  },
]

// Supabase returns timestamp (no timezone) columns without a "Z" suffix,
// which the Date constructor would otherwise parse as local time instead
// of UTC. Force UTC interpretation when no timezone is present.
function formatDate(dateStr: string): string {
  const hasTimezone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(dateStr)
  const date = new Date(hasTimezone ? dateStr : `${dateStr}Z`)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function FeedbackPage() {
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [filter, setFilter] = useState<FilterValue>("all")
  const [sort, setSort] = useState<SortValue>("newest")

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data } = await supabase
      .from("questions")
      .select("id, question_text, feedback_rating, feedback_comment, feedback_submitted_at")
      .eq("expert_id", userId)
      .not("feedback_rating", "is", null)
      .order("feedback_submitted_at", { ascending: false })

    setFeedback((data ?? []) as FeedbackRow[])
    setLoading(false)
  }

  const total = feedback.length
  const helpfulCount = feedback.filter((f) => f.feedback_rating === "up").length
  const notQuiteCount = total - helpfulCount
  const helpfulPercent = total > 0 ? Math.round((helpfulCount / total) * 100) : 0

  const visibleFeedback = useMemo(() => {
    let rows = feedback
    if (filter !== "all") {
      rows = rows.filter((f) => f.feedback_rating === filter)
    }
    rows = [...rows].sort((a, b) =>
      sort === "newest"
        ? b.feedback_submitted_at.localeCompare(a.feedback_submitted_at)
        : a.feedback_submitted_at.localeCompare(b.feedback_submitted_at)
    )
    return rows
  }, [feedback, filter, sort])

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  const circumference = 2 * Math.PI * 50
  const helpfulArc = (helpfulPercent / 100) * circumference

  return (
    <section>
      <h1 className="font-display text-xl text-ink">Feedback</h1>
      <p className="mt-1 text-sm text-ink-soft">
        See what askers have shared about your answers.
      </p>

      {total === 0 ? (
        <div className="mt-4 rounded-lg border border-line bg-card p-6">
          <p className="text-sm text-ink-soft">
            No feedback yet. Once askers rate your answers, it will show up
            here.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[65fr_35fr] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="rounded-lg border border-line bg-card p-5">
              <div className="grid grid-cols-3 divide-x divide-line text-center">
                <div>
                  <p className="font-display text-2xl text-ink">{total}</p>
                  <p className="text-xs text-ink-soft">feedback responses</p>
                </div>
                <div>
                  <p className="font-display text-2xl text-green-700">
                    {helpfulPercent}%
                  </p>
                  <p className="text-xs text-ink-soft">found answers helpful</p>
                </div>
                <div>
                  <p className="font-display text-2xl text-ink">
                    {helpfulCount}
                  </p>
                  <p className="text-xs text-ink-soft">
                    helpful &middot; {notQuiteCount} not quite
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterValue)}
                className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
              >
                <option value="all">All feedback</option>
                <option value="up">Helpful only</option>
                <option value="down">Not quite only</option>
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortValue)}
                className="rounded-sm border border-line px-3 py-2 text-sm text-ink"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            <div className="flex flex-col gap-3">
              {visibleFeedback.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-line bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-line/40 text-ink-soft">
                      <PersonIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.feedback_rating === "up"
                              ? "bg-green-500/10 text-green-700"
                              : "bg-postal-red/10 text-postal-red"
                          }`}
                        >
                          {item.feedback_rating === "up"
                            ? "Helpful"
                            : "Not quite what they needed"}
                        </span>
                        <span className="flex-shrink-0 text-xs text-ink-soft">
                          {formatDate(item.feedback_submitted_at)}
                        </span>
                      </div>
                      {item.feedback_comment && (
                        <p className="mt-2 text-sm text-ink">
                          &ldquo;{item.feedback_comment}&rdquo;
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-ink-soft">
                        Question: {item.question_text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-line bg-card p-4">
              <h2 className="text-sm font-semibold text-ink">
                Feedback summary
              </h2>
              <p className="mt-0.5 text-xs text-ink-soft">
                Based on {total} feedback response{total === 1 ? "" : "s"}
              </p>

              <div className="mt-4 flex items-center justify-center">
                <div className="relative h-36 w-36">
                  <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="#e45b4f"
                      strokeWidth="14"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={`${helpfulArc} ${circumference}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-display text-xl text-ink">
                      {helpfulPercent}%
                    </span>
                    <span className="text-[11px] leading-tight text-ink-soft">
                      found answers
                      <br />
                      helpful
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-ink-soft">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-600" />
                    Helpful
                  </span>
                  <span className="text-ink">
                    {helpfulCount} ({helpfulPercent}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-ink-soft">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-postal-red" />
                    Not quite what they needed
                  </span>
                  <span className="text-ink">
                    {notQuiteCount} ({100 - helpfulPercent}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-lavender/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
                  <LightbulbIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-ink">
                    Your feedback matters
                  </h3>
                  <p className="mt-1 text-xs text-ink-soft">
                    Feedback helps you understand what&apos;s working well
                    and how you can make your answers even more helpful.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-card p-4">
              <h3 className="text-sm font-semibold text-ink">
                Tips to get more positive feedback
              </h3>
              <div className="mt-3 flex flex-col gap-3">
                {tips.map((tip) => (
                  <div key={tip.title} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
                      <tip.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {tip.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {tip.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
