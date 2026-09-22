"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useQuestionCounts } from "../../questions-context"

type Question = {
  id: string
  question_text: string
  asker_email: string
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

function truncateEmail(email: string, maxLocalLength = 15): string {
  const [local, domain] = email.split("@")
  if (!domain || local.length <= maxLocalLength) return email
  return `${local.slice(0, maxLocalLength)}...@${domain}`
}

export default function QuestionsByStatusPage() {
  const params = useParams<{ status: string }>()
  const status = params.status
  const label = labels[status] ?? status
  const { refreshCounts } = useQuestionCounts()

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [expertName, setExpertName] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function loadQuestions() {
    setLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single()

    if (profileData) setExpertName(profileData.full_name)

    const { data, error } = await supabase
      .from("questions")
      .select("*")
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

    const question = questions.find((q) => q.id === questionId)

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: question?.stripe_payment_intent_id,
      }),
    })

    loadQuestions()
    refreshCounts()
    setProcessingId(null)
  }

  async function submitAnswer(questionId: string) {
    if (processingId) return
    setProcessingId(questionId)

    const question = questions.find((q) => q.id === questionId)

    const { error } = await supabase
      .from("questions")
      .update({
        answer_text: answerText,
        status: "answered",
        answered_at: new Date().toISOString(),
      })
      .eq("id", questionId)

    if (error) {
      setProcessingId(null)
      return
    }

    await fetch("/api/stripe/capture-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: question?.stripe_payment_intent_id,
      }),
    })

    await fetch("/api/send-answer-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        askerEmail: question?.asker_email,
        questionText: question?.question_text,
        answerText,
        expertName,
        questionId,
      }),
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
      <h2 className="font-display text-xl text-ink">
        {label} ({questions.length})
      </h2>
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
                {truncateEmail(q.asker_email)} &middot;{" "}
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
                  {truncateEmail(q.asker_email)} &middot;{" "}
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
