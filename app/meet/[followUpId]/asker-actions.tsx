"use client"

import { useEffect, useState } from "react"
import { cancellationKind } from "@/lib/follow-up-rules"

const GENERIC_ERROR = "Something went wrong. Please try again."

export default function AskerActions({
  followUpId,
  startIso,
  price,
}: {
  followUpId: string
  startIso: string
  price: string
}) {
  const [now, setNow] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // Starts null so the server-rendered page and first client render match.
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0)
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])

  if (now === null) return null
  const kind = cancellationKind(startIso, new Date(now))

  async function post(path: string, body: Record<string, unknown>) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : GENERIC_ERROR)
        setBusy(false)
        return
      }
      window.location.reload()
    } catch {
      setError(GENERIC_ERROR)
      setBusy(false)
    }
  }

  function cancel(late: boolean) {
    const message = late
      ? `Cancel now and be charged $${price}? This is the late-cancellation charge you agreed to when booking.`
      : "Cancel this conversation? Your card won't be charged."
    if (window.confirm(message)) {
      post("/api/follow-up/cancel-asker", { id: followUpId, acknowledgeLateCharge: late })
    }
  }

  function report() {
    if (
      window.confirm(
        "Report a problem with this conversation? We'll review it, and your card won't be charged unless we find it took place."
      )
    ) {
      post("/api/follow-up/report-problem", { id: followUpId })
    }
  }

  return (
    <div className="mt-8 rounded-lg border border-line bg-white p-5">
      {kind === "free" && (
        <>
          <h2 className="text-sm font-semibold text-ink">Need to cancel?</h2>
          <p className="mt-1 text-xs text-ink-soft">
            You can cancel for free until 24 hours before the start. Your card
            won&apos;t be charged.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => cancel(false)}
            className="mt-3 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink hover:border-postal-red hover:text-postal-red disabled:opacity-50"
          >
            {busy ? "Working..." : "Cancel conversation"}
          </button>
        </>
      )}

      {kind === "late" && (
        <>
          <h2 className="text-sm font-semibold text-ink">Need to cancel?</h2>
          <p className="mt-1 text-xs text-ink-soft">
            It&apos;s less than 24 hours before the start, so cancelling now
            charges your card ${price} in full, as described in the
            cancellation policy you agreed to.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => cancel(true)}
            className="mt-3 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink hover:border-postal-red hover:text-postal-red disabled:opacity-50"
          >
            {busy ? "Working..." : `Cancel and pay $${price}`}
          </button>
        </>
      )}

      {kind === "started" && (
        <>
          <h2 className="text-sm font-semibold text-ink">Something go wrong?</h2>
          <p className="mt-1 text-xs text-ink-soft">
            If the other person didn&apos;t show up or the call didn&apos;t
            work, tell us. We&apos;ll review it, and your card won&apos;t be
            charged unless we find the conversation took place.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={report}
            className="mt-3 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink hover:border-postal-red hover:text-postal-red disabled:opacity-50"
          >
            {busy ? "Working..." : "Report a problem"}
          </button>
        </>
      )}

      {error && <p className="mt-3 text-sm text-postal-red">{error}</p>}
    </div>
  )
}
