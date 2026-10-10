"use client"

import { useState } from "react"

// Help for a conversation that isn't connecting. It starts with the basics
// people can try themselves, and only when those haven't worked does it show
// the two ways out: a free reschedule, or a problem report. Those are one click
// away, not on the page by default.
export default function ConnectionHelp({
  started,
  busy,
  onReload,
  onReschedule,
  onReport,
}: {
  // Rescheduling and reporting only make sense once the conversation has started.
  started: boolean
  busy: boolean
  // Offered when the call is on this page and can be reloaded.
  onReload?: () => void
  onReschedule: () => void
  onReport: () => void
}) {
  const [stillStuck, setStillStuck] = useState(false)

  function reschedule() {
    if (
      window.confirm(
        "Reschedule this conversation for free? Your card won't be charged, and you'll both be emailed so a new time can be booked."
      )
    ) {
      onReschedule()
    }
  }

  return (
    <div className="rounded-sm bg-line/30 p-3 text-xs text-ink-soft">
      <p className="font-medium text-ink">Try these first</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4">
        <li>Allow microphone access when your browser asks, and check you aren&apos;t muted.</li>
        <li>{onReload ? "Reload the call." : "Refresh this page and join again."}</li>
        <li>Open the page in Chrome or Safari, not inside another app.</li>
        <li>Check your internet connection, or switch between Wi-Fi and mobile data.</li>
      </ul>

      {onReload && (
        <button
          type="button"
          onClick={onReload}
          className="mt-3 rounded-full border border-line bg-white px-4 py-1.5 text-xs font-medium text-ink hover:border-ink"
        >
          Reload the call
        </button>
      )}

      {!stillStuck ? (
        <p className="mt-3">
          <button
            type="button"
            onClick={() => setStillStuck(true)}
            className="font-medium text-ink underline underline-offset-2"
          >
            It&apos;s still not working
          </button>
        </p>
      ) : started ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="font-medium text-ink">Still not working?</p>
          <p className="mt-1">
            If a connection problem stops the conversation, you can reschedule it for free.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={reschedule}
              className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-medium text-ink hover:border-ink disabled:opacity-50"
            >
              {busy ? "Working..." : "Reschedule for free"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReport}
              className="text-xs font-medium text-ink-soft underline underline-offset-2 hover:text-ink"
            >
              Report a problem
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 border-t border-line pt-3">
          If it still isn&apos;t working once the conversation has started, you&apos;ll be able to
          reschedule it for free from here.
        </p>
      )}
    </div>
  )
}
