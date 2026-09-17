"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Question = {
  id: string
  question_text: string
  asker_email: string
  status: string
  created_at: string
  deadline_at: string
  answer_text: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState("")

  useEffect(() => {
    loadQuestions()
  }, [])

  async function loadQuestions() {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      router.push("/login")
      return
    }

    const userId = sessionData.session.user.id

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("expert_id", userId)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setQuestions(data)
    }
    setLoading(false)
  }

  async function submitAnswer(questionId: string) {
    const { error } = await supabase
      .from("questions")
      .update({
        answer_text: answerText,
        status: "answered",
        answered_at: new Date().toISOString(),
      })
      .eq("id", questionId)

    if (!error) {
      setAnswering(null)
      setAnswerText("")
      loadQuestions()
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-ink-soft">Loading...</p>
      </main>
    )
  }

  const pending = questions.filter((q) => q.status === "pending")
  const answered = questions.filter((q) => q.status === "answered")

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-3xl text-ink">Your questions</h1>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">
          Pending ({pending.length})
        </h2>
        <div className="mt-4 space-y-4">
          {pending.length === 0 && (
            <p className="text-ink-soft">No pending questions right now.</p>
          )}
          {pending.map((q) => (
            <div key={q.id} className="rounded-sm border border-line p-4">
              <p className="text-sm text-ink-soft">From {q.asker_email}</p>
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
                <button
                  onClick={() => {
                    setAnswering(q.id)
                    setAnswerText("")
                  }}
                  className="mt-3 rounded-sm bg-postal-red px-4 py-2 text-sm font-medium text-paper hover:bg-ink"
                >
                  Answer
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">
          Answered ({answered.length})
        </h2>
        <div className="mt-4 space-y-4">
          {answered.map((q) => (
            <div key={q.id} className="rounded-sm border border-line p-4">
              <p className="text-sm text-ink-soft">From {q.asker_email}</p>
              <p className="mt-1 text-ink">{q.question_text}</p>
              <p className="mt-2 border-t border-line pt-2 text-ink-soft">
                {q.answer_text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}