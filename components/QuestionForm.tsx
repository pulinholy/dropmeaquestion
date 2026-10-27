"use client"

import { useEffect, useState } from "react"
import { MailIcon, ShieldCheckIcon, InfoIcon, PaperclipIcon, VideoIcon } from "./icons"
import { formatResponseWindow } from "@/lib/format"
import DemoProfileModal from "./DemoProfileModal"
import { isUnchangedStarter } from "@/lib/question-form"

const MAX_QUESTION_LENGTH = 1000
const CHECKOUT_TIMEOUT_MS = 20000
const CHECKOUT_ERROR_MESSAGE =
  "We couldn't start your payment. Please check your connection and try again. You haven't been charged."

export default function QuestionForm({
  expertId,
  username,
  price,
  expertFirstName,
  responseWindowHours,
  topics,
  followUpPrice = null,
  guidance = null,
  starter = null,
  demo = false,
}: {
  expertId: string
  username: string
  price: string
  expertFirstName: string
  responseWindowHours: number
  topics: string[]
  // Set only when this expert can really invite a follow-up conversation.
  followUpPrice?: string | null
  // The expert's own note on what to include, and starter text that pre-fills
  // the box. Both are optional.
  guidance?: string | null
  starter?: string | null
  // Example profile: looks and behaves like the real form, but submitting
  // opens an explainer instead of ever contacting the checkout API.
  demo?: boolean
}) {
  const [question, setQuestion] = useState(starter ?? "")
  const [email, setEmail] = useState("")
  // Off unless the asker ticks it: the expert only ever sees an email that
  // was shared on purpose.
  const [shareEmail, setShareEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPaymentDetails, setShowPaymentDetails] = useState(false)
  const [showDemoModal, setShowDemoModal] = useState(false)

  // Coming back from Stripe with the browser's Back button can restore this
  // page from cache with the button still stuck on "Redirecting to payment...".
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setLoading(false)
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [])

  const placeholder =
    topics.length > 0
      ? `Ask about ${topics.join(", ")}, or anything else...`
      : `What's on your mind?`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (demo) {
      setShowDemoModal(true)
      return
    }
    if (isUnchangedStarter(question, starter)) {
      setError("Add your own details to the starter text before sending your question.")
      return
    }
    setLoading(true)
    setError("")

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CHECKOUT_TIMEOUT_MS)

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expertId,
          question,
          email,
          shareEmail,
          username,
        }),
        signal: controller.signal,
      })

      // A crashed server or an outage page returns HTML, not JSON.
      const data = await res.json().catch(() => null)

      if (!res.ok || typeof data?.url !== "string") {
        setError(
          typeof data?.error === "string" ? data.error : CHECKOUT_ERROR_MESSAGE
        )
        setLoading(false)
        return
      }

      window.location.href = data.url
    } catch {
      // Offline, dropped connection, or the request timed out.
      setError(CHECKOUT_ERROR_MESSAGE)
      setLoading(false)
    } finally {
      clearTimeout(timeout)
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} noValidate={demo} className="space-y-3 text-left">
      <div>
        <label className="block text-sm font-semibold text-ink">
          What would you like to ask {expertFirstName}?
        </label>
        <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-soft">
          {guidance ??
            "For the best answer, focus on one main question and include any helpful context."}
        </p>
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
          <p className="flex items-center gap-1.5 text-xs text-ink-soft">
            <PaperclipIcon className="h-3.5 w-3.5 flex-shrink-0" />
            You can add an image or PDF after checkout.
          </p>
          <p className="flex-shrink-0 text-right text-xs text-ink-soft">
            {question.length}/{MAX_QUESTION_LENGTH}
          </p>
        </div>
        {starter && isUnchangedStarter(question, starter) && (
          <button
            type="button"
            onClick={() => setQuestion("")}
            className="mt-1 text-xs font-medium text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            Start blank
          </button>
        )}
      </div>
      <div>
        <label className="block text-sm font-semibold text-ink">
          Your email (to receive the answer)
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
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={shareEmail}
            onChange={(e) => setShareEmail(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-postal-red"
          />
          <span>
            Share my email with {expertFirstName} so they can contact me directly
            (optional).
          </span>
        </label>
        <p className="mt-1 text-xs text-ink-soft">
          {shareEmail
            ? `🔓 ${expertFirstName} will see your email next to your question.`
            : `🔒 Your email stays private and isn't shared with ${expertFirstName}.`}
        </p>
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
            {formatResponseWindow(responseWindowHours)}.
          </p>
          <button
            type="button"
            onClick={() => setShowPaymentDetails((s) => !s)}
            className="flex flex-shrink-0 items-center gap-1 text-xs text-ink-soft/70 hover:text-ink"
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
                <span>Answer within {formatResponseWindow(responseWindowHours)}</span>
                <span className="flex-shrink-0 font-medium text-ink">
                  → ${price} charged
                </span>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span>No answer in {formatResponseWindow(responseWindowHours)}</span>
                <span className="flex-shrink-0 font-medium text-ink">
                  → No charge
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {followUpPrice && (
        <div className="flex items-center gap-3 border-t border-line pt-4">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-postal-red/10 text-postal-red">
            <VideoIcon className="h-5 w-5" />
          </span>
          <p className="text-sm text-ink-soft">
            After answering your question, {expertFirstName} may invite you to a paid
            15-minute follow-up conversation to discuss your answer further. It&apos;s
            completely optional.
          </p>
        </div>
      )}
    </form>
    {showDemoModal && (
      <DemoProfileModal onClose={() => setShowDemoModal(false)} />
    )}
    </>
  )
}
