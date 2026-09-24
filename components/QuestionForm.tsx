"use client"

import { useState } from "react"
import { MailIcon, ShieldCheckIcon, InfoIcon } from "./icons"

const MAX_QUESTION_LENGTH = 500

export default function QuestionForm({
  expertId,
  username,
  price,
  expertFirstName,
  responseWindowHours,
  topics,
}: {
  expertId: string
  username: string
  price: string
  expertFirstName: string
  responseWindowHours: number
  topics: string[]
}) {
  const [question, setQuestion] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPaymentDetails, setShowPaymentDetails] = useState(false)

  const placeholder =
    topics.length > 0
      ? `Ask about ${topics.join(", ")}, or anything else...`
      : `What's on your mind?`

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
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      <div>
        <label className="block text-sm font-semibold text-ink">
          What would you like to ask {expertFirstName}?
        </label>
        <textarea
          required
          rows={3}
          maxLength={MAX_QUESTION_LENGTH}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60"
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-soft">
            You can add a screenshot or PDF in the next step.
          </p>
          <p className="flex-shrink-0 text-right text-xs text-ink-soft">
            {question.length}/{MAX_QUESTION_LENGTH}
          </p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink">
          Your email (to send the answer)
        </label>
        <div className="relative mt-1">
          <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-sm border border-line py-2 pl-9 pr-3 text-ink placeholder:text-ink-soft/60"
          />
        </div>
      </div>
      {error && <p className="text-sm text-postal-red">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink disabled:opacity-50"
      >
        {loading ? (
          "Redirecting to payment..."
        ) : (
          <>
            Drop me a question — ${price} <span aria-hidden>→</span>
          </>
        )}
      </button>

      <div className="rounded-sm bg-line/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-ink">
            <ShieldCheckIcon className="h-5 w-5 flex-shrink-0 text-green-600" />
            You&apos;re only charged if {expertFirstName} answers within{" "}
            {responseWindowHours} hours.
          </p>
          <button
            type="button"
            onClick={() => setShowPaymentDetails((s) => !s)}
            className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"
          >
            How payment works <InfoIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {showPaymentDetails && (
          <div className="mt-3 space-y-2 border-t border-line/60 pt-3 text-xs text-ink-soft">
            <p>
              Your card is authorized for ${price} when you submit your
              question.
            </p>
            <div className="space-y-1">
              <p className="flex items-center justify-between gap-3">
                <span>Answer within {responseWindowHours} hours</span>
                <span className="flex-shrink-0 font-medium text-ink">
                  → ${price} charged
                </span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span>No answer in {responseWindowHours} hours</span>
                <span className="flex-shrink-0 font-medium text-ink">
                  → No charge
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </form>
  )
}
