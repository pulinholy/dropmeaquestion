"use client"

import { useState } from "react"

export default function QuestionForm({
  expertId,
  username,
  price,
}: {
  expertId: string
  username: string
  price: string
}) {
  const [question, setQuestion] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expertId,
        question,
        email,
        username,
      }),
    })

    const data = await res.json()

    if (data.error) {
      setError(data.error)
      setLoading(false)
      return
    }

    window.location.href = data.url
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-left">
      <div>
        <label className="block text-sm font-medium text-ink">
          Your question
        </label>
        <textarea
          required
          rows={4}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="mt-1 w-full rounded-sm border border-line bg-paper px-3 py-2 text-ink"
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
          className="mt-1 w-full rounded-sm border border-line bg-paper px-3 py-2 text-ink"
        />
      </div>
      {error && <p className="text-sm text-postal-red">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink disabled:opacity-50"
      >
        {loading ? "Redirecting to payment..." : `Drop me a question — $${price}`}
      </button>
      <p className="text-center text-xs text-ink-soft">
        You&apos;ll be able to attach a screenshot or PDF after payment.
      </p>
    </form>
  )
}