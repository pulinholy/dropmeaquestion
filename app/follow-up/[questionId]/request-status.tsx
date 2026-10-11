"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { formatPrice, formatSlot } from "@/lib/follow-up-rules"

const POLL_MS = 1500
const MAX_ATTEMPTS = 40

type State = "pending" | "sent" | "not_booked" | "slow"

// Shown right after paying. Checks the booking until the card hold is
// confirmed, so the person sees the real outcome instead of waiting for an
// email.
export default function RequestStatus({
  questionId,
  expertFirstName,
}: {
  questionId: string
  expertFirstName: string
}) {
  const [state, setState] = useState<State>("pending")
  const [slots, setSlots] = useState<string[]>([])
  const [timezone, setTimezone] = useState<string | null>(null)
  const [priceCents, setPriceCents] = useState<number | null>(null)
  const attempts = useRef(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll() {
      attempts.current += 1
      try {
        const res = await fetch(
          `/api/follow-up/status?questionId=${encodeURIComponent(questionId)}`,
          { cache: "no-store" }
        )
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (res.ok && (data?.state === "sent" || data?.state === "not_booked")) {
          if (Array.isArray(data.proposedSlots)) {
            setSlots(data.proposedSlots.filter((s: unknown): s is string => typeof s === "string"))
          }
          setTimezone(typeof data.timezone === "string" ? data.timezone : null)
          setPriceCents(typeof data.priceCents === "number" ? data.priceCents : null)
          setState(data.state)
          return
        }
      } catch {
        // Try again below.
      }
      if (cancelled) return
      if (attempts.current >= MAX_ATTEMPTS) {
        // Stop asking rather than claim something we can't back up.
        setState("slow")
        return
      }
      timer = setTimeout(poll, POLL_MS)
    }

    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [questionId])

  const box = "mx-auto max-w-md px-6 py-16 text-center"

  if (state === "sent") {
    return (
      <div className={box}>
        <h1 className="font-display text-3xl text-ink">Your conversation request has been sent</h1>
        <p className="mt-3 text-ink-soft">
          {expertFirstName} has 24 hours to confirm one of your proposed times. We&apos;ll email
          you when it&apos;s confirmed. If {expertFirstName} can&apos;t make any of them, we&apos;ll
          let you know and release the hold.
        </p>
        <p className="mt-3 text-ink-soft">
          {priceCents
            ? `Your card has a temporary $${formatPrice(priceCents)} hold.`
            : "Your card has a temporary hold."}{" "}
          You&apos;re only charged after the conversation takes place.
        </p>
        {slots.length > 0 && (
          <div className="mt-6 rounded-lg border border-line bg-white p-4 text-left">
            <p className="text-sm font-semibold text-ink">
              {slots.length === 1 ? "The time you proposed" : "The times you proposed"}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {slots.map((slot) => (
                <li key={slot}>{formatSlot(slot, timezone)}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-xs text-ink-soft">
          Keep the email we just sent you: it has the link to your private request page.
        </p>
      </div>
    )
  }

  if (state === "not_booked") {
    return (
      <div className={box}>
        <h1 className="font-display text-3xl text-ink">We couldn&apos;t book that</h1>
        <p className="mt-3 text-ink-soft">
          Your card hasn&apos;t been charged. You can try again with different times.
        </p>
        <Link
          href={`/follow-up/${questionId}`}
          className="mt-6 inline-block rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper hover:bg-ink"
        >
          Propose new times →
        </Link>
      </div>
    )
  }

  if (state === "slow") {
    return (
      <div className={box}>
        <h1 className="font-display text-3xl text-ink">Still confirming your request</h1>
        <p className="mt-3 text-ink-soft">
          This is taking longer than usual, but don&apos;t worry. We&apos;ll email you as soon as
          it&apos;s confirmed. You haven&apos;t been charged.
        </p>
      </div>
    )
  }

  return (
    <div className={box} aria-live="polite">
      <h1 className="font-display text-3xl text-ink">Thanks — we&apos;re processing your request</h1>
      <p className="mt-3 text-ink-soft">
        One moment while we confirm it with {expertFirstName}&apos;s page. Your card is held, not
        charged.
      </p>
    </div>
  )
}
