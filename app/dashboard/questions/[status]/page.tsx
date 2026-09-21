"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useQuestionCounts } from "../../questions-context"
import ActiveStatusBanner from "../../active-status-banner"

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
}

const labels: Record<string, string> = {
  pending: "Pending",
  answered: "Answered",
  declined: "Declined",
  expired: "Expired",
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
  const [expertName, setExpertName] = useState("")

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
    const question = questions.find((q) => q.id === questionId)

    const { error } = await supabase
      .from("questions")
      .update({ status: "declined" })
      .eq("id", questionId)

    if (error) return

    await fetch("/api/stripe/cancel-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: question?.stripe_payment_intent_id,
      }),
    })

    loadQuestions()
    refreshCounts()
  }

  async function submitAnswer(questionId: string) {
    const question = questions.find((q) => q.id === questionId)

    const { error } = await supabase
      .from("questions")
      .update({
        answer_text: answerText,
        status: "answered",
        answered_at: new Date().toISOString(),
      })
      .eq("id", questionId)

    if (error) return

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
      }),
    })

    setAnswering(null)
    setAnswerText("")
    loadQuestions()
    refreshCounts()
  }

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  return (
    <section>
      {status === "pending" && <ActiveStatusBanner />}

      <h2 className="font-display text-xl text-ink">
        {label} ({questions.length})
      </h2>
      <div className="mt-4 space-y-4">
        {questions.length === 0 && (
          <p className="text-ink-soft">No {label.toLowerCase()} questions.</p>
        )}
        {questions.map((q) => (
          <div key={q.id} className="rounded-sm border border-line p-4">
            <p className="text-sm text-ink-soft">From {q.asker_email}</p>
            <p className="mt-1 text-ink">{q.question_text}</p>

            {q.attachment_path && (
              <button
                onClick={() => viewAttachment(q.attachment_path!)}
                className="mt-2 text-sm text-postal-blue underline decoration-line underline-offset-4 hover:text-ink"
              >
                View attachment
              </button>
            )}

            {status === "pending" &&
              (answering === q.id ? (
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
                      className="rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-postal-blue"
                    >
                      Send Answer
                    </button>
                    <button
                      onClick={() => setAnswering(null)}
                      className="rounded-sm border border-line px-4 py-2 text-sm text-ink-soft"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setAnswering(q.id)
                      setAnswerText("")
                    }}
                    className="mt-3 mr-2 rounded-sm bg-postal-red px-4 py-2 text-sm font-medium text-paper hover:bg-ink"
                  >
                    Answer
                  </button>
                  <button
                    onClick={() => declineQuestion(q.id)}
                    className="mt-3 rounded-sm border border-line px-4 py-2 text-sm text-ink-soft hover:bg-line"
                  >
                    Decline
                  </button>
                </>
              ))}

            {status === "answered" && (
              <p className="mt-2 border-t border-line pt-2 text-ink-soft">
                {q.answer_text}
              </p>
            )}

            {status === "expired" && (
              <p className="mt-2 border-t border-line pt-2 text-sm text-ink-soft">
                Expired unanswered — the payment hold was released.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
