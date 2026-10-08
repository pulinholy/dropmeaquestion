"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useQuestionCounts } from "../../questions-context"

const statusTabs = [
  { status: "pending", label: "Pending" },
  { status: "answered", label: "Answered" },
  { status: "declined", label: "Declined" },
  { status: "expired", label: "Expired" },
] as const

type Question = {
  id: string
  question_text: string
  reference_id: string | null
  status: string
  created_at: string
  deadline_at: string
  answer_text: string | null
  stripe_payment_intent_id: string | null
  attachment_path: string | null
  feedback_rating: "up" | "down" | null
  feedback_comment: string | null
}

const labels: Record<string, string> = {
  pending: "Pending",
  answered: "Answered",
  declined: "Declined",
  expired: "Expired",
}

// Supabase returns timestamp (no timezone) columns without a "Z" suffix,
// which the Date constructor would otherwise parse as local time instead
// of UTC. Force UTC interpretation when no timezone is present.
function parseUtcDate(dateStr: string): Date {
  const hasTimezone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(dateStr)
  return new Date(hasTimezone ? dateStr : `${dateStr}Z`)
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - parseUtcDate(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`
}

function formatShortDate(dateStr: string): string {
  const date = parseUtcDate(dateStr)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  })
}

export default function QuestionsByStatusPage() {
  const params = useParams<{ status: string }>()
  const status = params.status
  const label = labels[status] ?? status
  const { counts, refreshCounts } = useQuestionCounts()

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Whether this expert has follow-up conversations switched on in Pricing,
  // and whether to offer one with the answer being written.
  const [followUpOn, setFollowUpOn] = useState(false)
  const [offerFollowUp, setOfferFollowUp] = useState(true)

  useEffect(() => {
    loadQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return
      // Fails harmlessly (option hidden) before the follow-up SQL has run.
      const { data } = await supabase
        .from("experts")
        .select("follow_up_enabled, follow_up_price_cents")
        .eq("id", sessionData.session.user.id)
        .maybeSingle()
      if (!cancelled) {
        setFollowUpOn(Boolean(data?.follow_up_enabled && data.follow_up_price_cents))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadQuestions() {
    setLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    // Explicit column list -- asker_email is deliberately excluded so it
    // never reaches the expert's browser, not just hidden from the UI.
    const { data, error } = await supabase
      .from("questions")
      .select(
        "id, question_text, reference_id, status, created_at, deadline_at, answer_text, stripe_payment_intent_id, attachment_path, feedback_rating, feedback_comment"
      )
      .eq("expert_id", userId)
      .eq("status", status)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setQuestions(data)
    }
    setLoading(false)
  }

  async function viewAttachment(path: string) {
    const { data, error } = await supabase.storage
      .from("question-attachments")
      .createSignedUrl(path, 60 * 60)

    if (!error && data) {
      window.open(data.signedUrl, "_blank")
    }
  }

  async function declineQuestion(questionId: string) {
    if (processingId) return
    setProcessingId(questionId)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setProcessingId(null)
      return
    }

    const { error } = await supabase
      .from("questions")
      .update({ status: "declined" })
      .eq("id", questionId)

    if (error) {
      setProcessingId(null)
      return
    }

    await fetch("/api/stripe/cancel-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({ questionId }),
    })

    loadQuestions()
    refreshCounts()
    setProcessingId(null)
  }

  async function submitAnswer(questionId: string) {
    if (processingId) return
    setProcessingId(questionId)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setProcessingId(null)
      return
    }
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`,
    }

    // answered_at is set server-side by a trigger, not here -- so it's
    // never dependent on the expert's own device clock being correct.
    const { error } = await supabase
      .from("questions")
      .update({
        answer_text: answerText,
        status: "answered",
      })
      .eq("id", questionId)

    if (error) {
      setProcessingId(null)
      return
    }

    await fetch("/api/stripe/capture-payment", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ questionId }),
    })

    await fetch("/api/send-answer-email", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ questionId, offerFollowUp: !followUpOn || offerFollowUp }),
    })

    setAnswering(null)
    setAnswerText("")
    loadQuestions()
    refreshCounts()
    setProcessingId(null)
  }

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  return (
    <section>
      <h1 className="font-display text-2xl text-ink">Questions</h1>
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {statusTabs.map((tab) => {
          const active = tab.status === status
          return (
            <Link
              key={tab.status}
              href={`/dashboard/questions/${tab.status}`}
              className={`flex-shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                active
                  ? "border-postal-red text-postal-red"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {tab.label} ({counts[tab.status]})
            </Link>
          )
        })}
      </div>
      <div className="mt-4 space-y-3">
        {questions.length === 0 && (
          <p className="text-ink-soft">No {label.toLowerCase()} questions.</p>
        )}

        {status === "pending" &&
          questions.map((q) => (
            <div key={q.id} className="rounded-sm border border-line p-4">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-postal-red" />
                <span className="text-xs font-medium tracking-wide text-postal-red">
                  NEW
                </span>
              </div>

              <p className="mt-2 text-sm text-ink-soft">
                {q.reference_id && `#${q.reference_id} · `}
                {formatRelativeTime(q.created_at)}
              </p>
              <p className="mt-1 text-ink">{q.question_text}</p>

              {answering === q.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={3}
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    className="w-full rounded-sm border border-line px-3 py-2 text-ink"
                    placeholder="Write your answer..."
                  />
                  {followUpOn && (
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={offerFollowUp}
                        onChange={(e) => setOfferFollowUp(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded-sm border-line accent-postal-red"
                      />
                      Offer 15-minute follow-up conversations after I answer
                    </label>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitAnswer(q.id)}
                      disabled={processingId === q.id}
                      className="rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-postal-blue disabled:opacity-50"
                    >
                      {processingId === q.id ? "Sending..." : "Send Answer"}
                    </button>
                    <button
                      onClick={() => setAnswering(null)}
                      disabled={processingId === q.id}
                      className="rounded-sm border border-line px-3 py-1.5 text-sm text-ink-soft disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between">
                  {q.attachment_path ? (
                    <button
                      onClick={() => viewAttachment(q.attachment_path!)}
                      className="text-sm text-postal-blue underline decoration-line underline-offset-4 hover:text-ink"
                    >
                      View attachment
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setAnswering(q.id)
                        setAnswerText("")
                        setOfferFollowUp(true)
                      }}
                      className="rounded-sm bg-postal-red px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink"
                    >
                      Answer
                    </button>
                    <button
                      onClick={() => declineQuestion(q.id)}
                      disabled={processingId === q.id}
                      className="rounded-sm border border-line px-3 py-1.5 text-sm text-ink-soft hover:bg-line disabled:opacity-50"
                    >
                      {processingId === q.id ? "Declining..." : "Decline"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

        {status !== "pending" &&
          questions.map((q) => {
            const expanded = expandedId === q.id
            return (
              <div key={q.id} className="rounded-sm border border-line p-4">
                <p className="text-sm text-ink-soft">
                  {q.reference_id && `#${q.reference_id} · `}
                  {formatShortDate(q.created_at)}
                </p>
                <p className="mt-1 text-ink">{q.question_text}</p>

                {q.feedback_rating && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        q.feedback_rating === "up"
                          ? "bg-green-500"
                          : "bg-ink-soft/40"
                      }`}
                    />
                    <span className="text-xs font-medium text-ink-soft">
                      Feedback:{" "}
                      {q.feedback_rating === "up"
                        ? "Helpful"
                        : "Not quite what they needed"}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => setExpandedId(expanded ? null : q.id)}
                  className="mt-1 text-sm text-ink-soft hover:text-ink"
                >
                  {label} &middot; {expanded ? "Hide" : "View →"}
                </button>

                {expanded && (
                  <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm text-ink-soft">
                    {status === "answered" && (
                      <p className="whitespace-pre-wrap">{q.answer_text}</p>
                    )}
                    {status === "declined" && (
                      <p>Declined — the payment hold was released.</p>
                    )}
                    {status === "expired" && (
                      <p>Expired unanswered — the payment hold was released.</p>
                    )}
                    {q.feedback_comment && (
                      <p className="border-t border-line pt-2 italic text-ink-soft">
                        &ldquo;{q.feedback_comment}&rdquo;
                      </p>
                    )}
                    {q.attachment_path && (
                      <button
                        onClick={() => viewAttachment(q.attachment_path!)}
                        className="text-sm text-postal-blue underline decoration-line underline-offset-4 hover:text-ink"
                      >
                        View attachment
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </section>
  )
}
