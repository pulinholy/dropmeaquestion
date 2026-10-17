"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { formatPrice } from "@/lib/follow-up-rules"
import { isPastDeadline, parseUtcDate } from "@/lib/question-deadline"
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

// When the expert has to reply by, in their own time zone.
function formatReplyBy(deadlineAt: string): string {
  return parseUtcDate(deadlineAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
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
  const [followUpPriceCents, setFollowUpPriceCents] = useState<number | null>(null)
  const [offerFollowUp, setOfferFollowUp] = useState(true)
  const [answerError, setAnswerError] = useState<{ id: string; message: string } | null>(null)
  // Shown when an answer was saved and sent but its payment didn't go through
  // at once. It is retried automatically, so this is only a heads-up.
  const [paymentNotice, setPaymentNotice] = useState("")

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
        .select("follow_up_allowed, follow_up_enabled, follow_up_price_cents")
        .eq("id", sessionData.session.user.id)
        .maybeSingle()
      if (!cancelled) {
        setFollowUpPriceCents(
          data?.follow_up_allowed && data.follow_up_enabled && data.follow_up_price_cents
            ? data.follow_up_price_cents
            : null
        )
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
      .in("status", status === "pending" || status === "expired" ? ["pending", "expired"] : [status])
      .order("created_at", { ascending: false })

    if (!error && data) {
      // A pending question whose response time has run out counts as expired
      // straight away. The row itself only changes when the nightly job runs,
      // which also releases the card hold and emails the asker.
      setQuestions(
        data.filter((q) =>
          status === "pending"
            ? q.status === "pending" && !isPastDeadline(q.deadline_at)
            : status === "expired"
              ? q.status === "expired" || (q.status === "pending" && isPastDeadline(q.deadline_at))
              : true
        )
      )
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

    setAnswerError(null)

    // Saved on the server, which refuses an answer once the response time has
    // run out. answered_at is set by a database trigger, never by this device.
    const saveRes = await fetch("/api/answer-question", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ questionId, answerText }),
    }).catch(() => null)

    if (!saveRes || !saveRes.ok) {
      const saveData = saveRes ? await saveRes.json().catch(() => null) : null
      setAnswerError({
        id: questionId,
        message:
          typeof saveData?.error === "string"
            ? saveData.error
            : "We couldn't save your answer. Please try again.",
      })
      if (saveData?.expired) {
        setAnswering(null)
        loadQuestions()
        refreshCounts()
      }
      setProcessingId(null)
      return
    }

    const captureRes = await fetch("/api/stripe/capture-payment", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ questionId }),
    }).catch(() => null)
    if (!captureRes || !captureRes.ok) {
      setPaymentNotice(
        "Your answer was sent, but its payment didn't go through straight away. We'll keep trying automatically, and you don't need to do anything."
      )
    } else {
      setPaymentNotice("")
    }

    await fetch("/api/send-answer-email", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ questionId, offerFollowUp: followUpPriceCents === null || offerFollowUp }),
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
      {paymentNotice && (
        <p role="status" className="mt-3 rounded-lg border border-line bg-card px-4 py-3 text-sm text-ink-soft">
          {paymentNotice}
        </p>
      )}
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
                {formatRelativeTime(q.created_at)} · Reply by {formatReplyBy(q.deadline_at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-ink">{q.question_text}</p>

              {answerError && answerError.id === q.id && (
                <p role="alert" className="mt-2 text-sm text-postal-red">
                  {answerError.message}
                </p>
              )}

              {answering === q.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={3}
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    className="w-full rounded-sm border border-line px-3 py-2 text-ink"
                    placeholder="Write your answer..."
                  />
                  {followUpPriceCents !== null && (
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/30 ${
                        offerFollowUp ? "border-ink" : "border-line hover:border-ink-soft/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={offerFollowUp}
                        onChange={(e) => setOfferFollowUp(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                          offerFollowUp ? "bg-ink text-white" : "border-2 border-line"
                        }`}
                      >
                        {offerFollowUp && (
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3.5 8.5l3 3 6-6.5" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-semibold text-ink">
                          Offer this asker a 15-minute follow-up conversation
                        </span>
                        <span className="mt-1 block text-xs text-ink-soft">
                          They&apos;ll receive an invitation with your answer and can request a
                          conversation at your set price of ${formatPrice(followUpPriceCents)}.
                        </span>
                      </span>
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
                <p className="mt-1 whitespace-pre-wrap text-ink">{q.question_text}</p>

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
                      <p>
                        {q.status === "pending"
                          ? "Expired unanswered — the payment hold is being released."
                          : "Expired unanswered — the payment hold was released."}
                      </p>
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
