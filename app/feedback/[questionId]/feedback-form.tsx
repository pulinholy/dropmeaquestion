"use client"

import { useState } from "react"

const MAX_COMMENT_LENGTH = 500

export default function FeedbackForm({
  questionId,
  expertFirstName,
  questionText,
}: {
  questionId: string
  expertFirstName: string
  questionText: string
}) {
  const [rating, setRating] = useState<"up" | "down" | null>(null)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) {
      setError("Please choose an option first.")
      return
    }

    setSubmitting(true)
    setError("")

    const res = await fetch("/api/submit-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, rating, comment }),
    })
    const data = await res.json()

    if (data.error) {
      setError(data.error)
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <>
        <h1 className="font-display text-3xl text-ink">Thanks!</h1>
        <p className="mt-3 text-ink-soft">
          Your feedback has been sent to {expertFirstName}.
        </p>
      </>
    )
  }

  return (
    <>
      <h1 className="font-display text-3xl text-ink">How was your answer?</h1>
      <p className="mt-3 text-ink-soft">
        This goes directly to {expertFirstName} — it&apos;s private, not shown
        publicly.
      </p>

      <blockquote className="mt-4 w-full rounded-sm border border-line p-4 text-left text-sm text-ink-soft">
        {questionText}
      </blockquote>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setRating("up")}
            className={`flex-1 rounded-sm border px-4 py-3 text-sm font-medium transition-colors ${
              rating === "up"
                ? "border-postal-red bg-postal-red/10 text-postal-red"
                : "border-line text-ink hover:bg-line/30"
            }`}
          >
            This was helpful
          </button>
          <button
            type="button"
            onClick={() => setRating("down")}
            className={`flex-1 rounded-sm border px-4 py-3 text-sm font-medium transition-colors ${
              rating === "down"
                ? "border-postal-red bg-postal-red/10 text-postal-red"
                : "border-line text-ink hover:bg-line/30"
            }`}
          >
            Not quite what I needed
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">
            Anything else you&apos;d like {expertFirstName} to know? (optional)
          </label>
          <textarea
            rows={3}
            maxLength={MAX_COMMENT_LENGTH}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
          <p className="mt-1 text-right text-xs text-ink-soft">
            {comment.length}/{MAX_COMMENT_LENGTH}
          </p>
        </div>

        {error && <p className="text-sm text-postal-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send feedback"}
        </button>
      </form>
    </>
  )
}
