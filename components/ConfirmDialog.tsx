"use client"

import { useEffect, useId, useRef } from "react"

// A confirmation in DMQ's own style, used instead of the browser's alert. It
// is a real modal: focus moves into it, Tab stays inside, Escape or a click
// outside closes it, and focus returns to what opened it. It only asks; the
// server still checks everything before anything is charged.
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Not yet",
  busy = false,
  tone = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  // "danger" is for actions the person may not want, such as a late cancellation.
  tone?: "default" | "danger"
  onConfirm: () => void
  onCancel: () => void
}) {
  const titleId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    onCancelRef.current = onCancel
  })

  useEffect(() => {
    if (!open) return
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Start on the safe choice, so an accidental Enter doesn't charge anyone.
    cancelRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onCancelRef.current()
        return
      }
      if (e.key !== "Tab") return
      const first = cancelRef.current
      const last = confirmRef.current
      if (!first || !last) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
      returnTo.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-xl"
      >
        <h2 id={titleId} className="font-display text-xl text-ink">
          {title}
        </h2>
        <div className="mt-3 space-y-2 text-sm text-ink-soft">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-full border border-line px-5 py-2 text-sm font-medium text-ink hover:border-ink disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              tone === "danger" ? "bg-postal-red hover:bg-ink" : "bg-ink hover:bg-postal-blue"
            }`}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
