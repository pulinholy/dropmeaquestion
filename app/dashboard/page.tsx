"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useQuestionCounts } from "./questions-context"
import { useProfileInfo } from "./profile-context"

const EXPERT_NET_RATE = 0.85

type Stats = {
  totalEarnedCents: number
  helpfulCount: number
  totalFeedback: number
  recentComment: string | null
}

export default function DashboardHomePage() {
  const { counts } = useQuestionCounts()
  const { profile } = useProfileInfo()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data } = await supabase
      .from("questions")
      .select("price_cents, feedback_rating, feedback_comment, feedback_submitted_at")
      .eq("expert_id", userId)
      .eq("status", "answered")

    const rows = data ?? []
    const totalEarnedCents = rows.reduce((sum, q) => sum + Math.round((q.price_cents ?? 0) * EXPERT_NET_RATE), 0)

    const feedbackRows = rows.filter((q) => q.feedback_rating)
    const helpfulCount = feedbackRows.filter((q) => q.feedback_rating === "up").length

    const recentWithComment = rows
      .filter((q) => q.feedback_comment)
      .sort((a, b) => (b.feedback_submitted_at ?? "").localeCompare(a.feedback_submitted_at ?? ""))[0]

    setStats({
      totalEarnedCents,
      helpfulCount,
      totalFeedback: feedbackRows.length,
      recentComment: recentWithComment?.feedback_comment ?? null,
    })
  }

  const firstName = profile.fullName?.split(" ")[0] || profile.fullName

  return (
    <section>
      <h2 className="font-display text-2xl text-ink">
        Welcome back{firstName ? `, ${firstName}` : ""}
      </h2>

      {counts.pending > 0 ? (
        <div className="mt-5 rounded-sm border border-postal-red/30 bg-postal-red/5 p-5">
          <p className="font-medium text-ink">
            You have {counts.pending} new question{counts.pending === 1 ? "" : "s"}{" "}
            waiting
          </p>
          <Link
            href="/dashboard/questions/pending"
            className="mt-3 inline-block rounded-full bg-postal-red px-5 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink"
          >
            Answer now →
          </Link>
        </div>
      ) : (
        <div className="mt-5 rounded-sm border border-line p-5">
          <p className="text-ink-soft">
            You&apos;re all caught up — no pending questions.
          </p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-sm border border-line p-4">
          <p className="font-display text-2xl text-ink">{counts.answered}</p>
          <p className="text-sm text-ink-soft">Questions answered</p>
        </div>
        <div className="rounded-sm border border-line p-4">
          <p className="font-display text-2xl text-ink">
            ${((stats?.totalEarnedCents ?? 0) / 100).toFixed(2)}
          </p>
          <p className="text-sm text-ink-soft">Total earned</p>
        </div>
        {stats && stats.totalFeedback >= 3 && (
          <div className="rounded-sm border border-line p-4">
            <p className="font-display text-2xl text-ink">
              {stats.helpfulCount}/{stats.totalFeedback}
            </p>
            <p className="text-sm text-ink-soft">Rated helpful</p>
          </div>
        )}
      </div>

      {stats?.recentComment && (
        <div className="mt-8 rounded-sm border border-line bg-lavender p-5">
          <p className="text-sm font-medium text-ink">Recent feedback</p>
          <p className="mt-2 italic text-ink">&ldquo;{stats.recentComment}&rdquo;</p>
        </div>
      )}
    </section>
  )
}
