"use client"

import { useState } from "react"
import {
  FOLLOW_UP_PROBLEM_NOTE_MAX,
  FOLLOW_UP_PROBLEM_REASONS,
  problemReasonLabel,
  type FollowUpProblemReason,
} from "@/lib/follow-up-rules"

// Asks what went wrong with a follow-up conversation before it's reported.
// Used by the asker's join page and the expert's Conversations page.
export default function ReportProblemForm({
  role,
  busy,
  onSubmit,
  onCancel,
}: {
  role: "asker" | "expert"
  busy: boolean
  onSubmit: (reason: FollowUpProblemReason, note: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState<FollowUpProblemReason | null>(null)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) {
      setError("Please choose what went wrong.")
      return
    }
    if (reason === "other" && note.trim().length < 3) {
      setError("Please tell us a little about what happened.")
      return
    }
    setError("")
    onSubmit(reason, note.trim())
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <fieldset>
        <legend className="text-sm font-semibold text-ink">What went wrong?</legend>
        <div className="mt-2 space-y-1.5">
          {FOLLOW_UP_PROBLEM_REASONS.map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="problem-reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="h-4 w-4 accent-postal-red"
              />
              {problemReasonLabel(value, role)}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="problem-note" className="text-xs font-medium text-ink-soft">
          {reason === "other" ? "Tell us what happened" : "Anything else we should know? (optional)"}
        </label>
        <textarea
          id="problem-note"
          rows={3}
          maxLength={FOLLOW_UP_PROBLEM_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
        />
      </div>

      <p className="text-xs text-ink-soft">
        We&apos;ll hold the payment and review it. Nothing is charged or paid
        until we have.
      </p>

      {error && <p className="text-sm text-postal-red">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-white hover:bg-postal-blue disabled:opacity-50"
        >
          {busy ? "Sending..." : "Send report"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="text-xs font-medium text-ink-soft hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
