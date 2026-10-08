"use client"

import { useEffect, useState } from "react"
import {
  FOLLOW_UP_MAX_DAYS_AHEAD,
  FOLLOW_UP_MAX_SLOTS,
  formatSlot,
} from "@/lib/follow-up-rules"
import { CheckIcon, LockIcon, VideoIcon } from "@/components/icons"

const REQUEST_TIMEOUT_MS = 20000
const REQUEST_ERROR =
  "We couldn't start your payment. Please check your connection and try again. You haven't been charged."

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function roundUpToQuarterHour(date: Date): Date {
  const quarter = 15 * 60 * 1000
  return new Date(Math.ceil(date.getTime() / quarter) * quarter)
}

// Start times sit on a 15-minute grid. Browsers let people type any minute,
// so a typed time is nudged to the nearest quarter hour (and kept inside the
// allowed range) rather than blocking the form with a browser error.
function snapToQuarterHour(value: string, min: string, max: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const quarter = 15 * 60 * 1000
  const snapped = toLocalInputValue(new Date(Math.round(date.getTime() / quarter) * quarter))
  if (min && snapped < min) return min
  if (max && snapped > max) return toLocalInputValue(
    new Date(Math.floor(new Date(max).getTime() / quarter) * quarter)
  )
  return snapped
}

export default function BookingForm({
  questionId,
  expertFirstName,
  referenceId,
  price,
  policyLines,
  privacyLines,
  policyVersion,
}: {
  questionId: string
  expertFirstName: string
  referenceId: string | null
  price: string
  // Chosen on the server, because the wording depends on how conversations
  // are held.
  policyLines: string[]
  privacyLines: string[]
  policyVersion: string
}) {
  const [slots, setSlots] = useState<string[]>(
    Array.from({ length: FOLLOW_UP_MAX_SLOTS }, () => "")
  )
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  // Set after mount: they depend on the visitor's clock, which would not
  // match the server-rendered page.
  const [bounds, setBounds] = useState<{ min: string; max: string } | null>(null)
  const [timezone, setTimezone] = useState("")

  useEffect(() => {
    // 25 hours leaves a little slack over the 24-hour notice rule.
    const min = roundUpToQuarterHour(new Date(Date.now() + 25 * 3600 * 1000))
    const max = new Date(Date.now() + FOLLOW_UP_MAX_DAYS_AHEAD * 24 * 3600 * 1000)
    setBounds({ min: toLocalInputValue(min), max: toLocalInputValue(max) })
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "")
  }, [])

  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setSubmitting(false)
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [])

  function setSlot(index: number, value: string) {
    setSlots((current) => current.map((s, i) => (i === index ? value : s)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    // Pressing Enter in a field skips the blur that snaps its time.
    const chosen = slots
      .filter(Boolean)
      .map((value) => new Date(bounds ? snapToQuarterHour(value, bounds.min, bounds.max) : value))
      .filter((d) => !Number.isNaN(d.getTime()))
    if (chosen.length === 0) {
      setError("Propose at least one time.")
      return
    }
    if (!accepted) {
      setError("Please agree to the cancellation policy to continue.")
      return
    }

    setSubmitting(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch("/api/follow-up/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          slots: chosen.map((d) => d.toISOString()),
          timezone,
          acceptedPolicy: true,
          policyVersion,
        }),
        signal: controller.signal,
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || typeof data?.url !== "string") {
        setError(typeof data?.error === "string" ? data.error : REQUEST_ERROR)
        setSubmitting(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError(REQUEST_ERROR)
      setSubmitting(false)
    } finally {
      clearTimeout(timeout)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
          <VideoIcon className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-3xl text-ink">
          Talk it through with {expertFirstName}
        </h1>
        <p className="mt-2 text-ink-soft">
          A private 15-minute conversation about your question
          {referenceId ? ` (#${referenceId})` : ""} &mdash; ${price}.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6 rounded-lg border border-line bg-white p-6 shadow-sm"
      >
        <div>
          <h2 className="text-sm font-semibold text-ink">
            1. Propose up to {FOLLOW_UP_MAX_SLOTS} times
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Choose times between 24 hours and {FOLLOW_UP_MAX_DAYS_AHEAD} days from
            now{timezone ? ` (your time zone: ${timezone})` : ""}.{" "}
            {expertFirstName} will confirm one.
          </p>
          <div className="mt-3 space-y-2">
            {slots.map((value, index) => {
              const iso = value ? new Date(value) : null
              const valid = iso && !Number.isNaN(iso.getTime())
              return (
                <div key={index}>
                  <input
                    type="datetime-local"
                    min={bounds?.min}
                    max={bounds?.max}
                    value={value}
                    onChange={(e) => setSlot(index, e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value && bounds) {
                        setSlot(
                          index,
                          snapToQuarterHour(e.target.value, bounds.min, bounds.max)
                        )
                      }
                    }}
                    aria-label={`Proposed time ${index + 1}${index === 0 ? "" : " (optional)"}`}
                    required={index === 0}
                    className="w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
                  />
                  {valid && (
                    <p className="mt-1 text-xs text-ink-soft">
                      {formatSlot(iso.toISOString(), timezone || undefined)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-ink">2. How it works</h2>
          <ul className="mt-2 space-y-2">
            {policyLines.map((line) => (
              <li key={line} className="flex items-start gap-2 text-xs text-ink-soft">
                <CheckIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-sm bg-line/30 p-3">
          <p className="flex items-start gap-2 text-xs text-ink">
            <LockIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-700" />
            {privacyLines[0]}
          </p>
          <p className="mt-2 text-xs text-ink-soft">{privacyLines[1]}</p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded-sm border-line accent-postal-red"
          />
          I&apos;ve read and agree to the cancellation policy above.
        </label>

        {error && <p className="text-sm text-postal-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink disabled:opacity-50"
        >
          {submitting ? (
            "Redirecting to payment..."
          ) : (
            <>
              Continue to payment &mdash; ${price} <span aria-hidden>→</span>
            </>
          )}
        </button>
        <p className="text-center text-xs text-ink-soft">
          Your card is only held for now. You&apos;re charged after the
          conversation takes place.
        </p>
      </form>
    </div>
  )
}
