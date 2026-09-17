"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function QuestionForm({
  expertId,
  price,
  responseWindowHours,
}: {
  expertId: string
  price: string
  responseWindowHours: number
}) {
  const [question, setQuestion] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const deadline = new Date()
    deadline.setHours(deadline.getHours() + responseWindowHours)

    const { error: insertError } = await supabase.from("questions").insert({
      expert_id: expertId,
      asker_email: email,
      question_text: question,
      deadline_at: deadline.toISOString(),
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="mt-4">
        <p className="font-medium text-ink">Question sent!</p>
        <p className="mt-1 text-ink-soft">
          You&apos;ll get an answer at {email} within {responseWindowHours}
          h.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink">
          Your question
        </label>
        <textarea
          required
          rows={4}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink">
          Your email (to send the answer)
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
        />
      </div>
      {error && <p className="text-sm text-postal-red">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-postal-blue disabled:opacity-50"
      >
        {loading ? "Sending..." : `Drop a Question — $${price}`}
      </button>
    </form>
  )
}