"use client"

import { useActiveStatus } from "./active-status-context"

export default function ActiveStatusBanner() {
  const { isActive, loading, toggling, toggleActive } = useActiveStatus()

  if (loading) return null

  return (
    <div className="mb-6 flex items-center justify-between rounded-sm border border-line p-4">
      <div>
        <p className="text-sm font-medium text-ink">
          {isActive ? "Currently accepting questions" : "Paused — not accepting questions"}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {isActive
            ? "Visitors can drop you a question right now."
            : "Your page shows a friendly away message instead of the form."}
        </p>
      </div>
      <button
        onClick={toggleActive}
        disabled={toggling}
        className="rounded-sm border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-line disabled:opacity-50"
      >
        {isActive ? "Pause" : "Resume"}
      </button>
    </div>
  )
}
