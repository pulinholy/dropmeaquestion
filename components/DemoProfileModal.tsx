"use client"

import { useEffect, useRef } from "react"

export default function DemoProfileModal({ onClose }: { onClose: () => void }) {
  const primaryRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    primaryRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-modal-title"
        className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="demo-modal-title"
          className="font-display text-2xl font-semibold text-ink"
        >
          This is an example profile
        </h2>
        <p className="mt-3 text-sm text-ink-soft">
          This page shows what your customers could see when they visit your
          Drop Me A Question page.
        </p>
        <p className="mt-3 text-sm font-medium text-ink">
          Ready to create yours?
        </p>
        <a
          ref={primaryRef}
          href="/register"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink"
        >
          Create your page <span aria-hidden>→</span>
        </a>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
        >
          Continue exploring the example
        </button>
      </div>
    </div>
  )
}
