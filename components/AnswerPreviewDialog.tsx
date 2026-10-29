"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { DocumentIcon } from "@/components/icons"

// "Preview & Send": shows the real PDF the asker will be able to download, built
// by the server from the answer as written, before anything is saved, charged or
// emailed. Confirming runs the normal send; going back changes nothing.
//
// Phones and tablets can't show a PDF inside a page, so there the preview is a
// file card that opens the PDF in its own tab.
//
// Mount it only while the window should be showing: each mount builds a fresh
// PDF from the current text.
export default function AnswerPreviewDialog({
  questionId,
  answerText,
  sending,
  onBack,
  onConfirm,
}: {
  questionId: string
  answerText: string
  sending: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  const backRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const onBackRef = useRef(onBack)
  const sendingRef = useRef(sending)

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  // Whether this browser can show a PDF inside the page. Only read once the
  // window is on screen, so the server render never depends on it.
  const [canEmbed] = useState(() => {
    if (typeof window === "undefined") return false
    const nav = navigator as Navigator & { pdfViewerEnabled?: boolean }
    return window.matchMedia("(pointer: fine)").matches && nav.pdfViewerEnabled === true
  })

  useEffect(() => {
    onBackRef.current = onBack
    sendingRef.current = sending
  })

  // Build the PDF when the window opens, so it always matches the text.
  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) throw new Error("Please log in again.")
        const res = await fetch("/api/preview-answer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({ questionId, answerText }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(
            typeof data?.error === "string" ? data.error : "We couldn't build the preview. Please try again."
          )
        }
        const blob = await res.blob()
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPdfUrl(url)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "We couldn't build the preview. Please try again.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
    // The text can't change while the window is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId])

  // A real modal: focus moves in, Tab stays inside, Escape goes back to editing.
  useEffect(() => {
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    backRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        if (!sendingRef.current) onBackRef.current()
        return
      }
      if (e.key !== "Tab") return
      const first = backRef.current
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
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !sending) onBack()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-lg border border-line bg-white p-5 shadow-xl sm:rounded-lg sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-xl text-ink">
              Preview your answer
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              This is the PDF your asker can view and download from their email. Nothing is sent
              until you confirm.
            </p>
          </div>
          {pdfUrl && canEmbed && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-xs font-medium text-postal-blue underline decoration-line underline-offset-4 hover:text-ink"
            >
              Open in new tab
            </a>
          )}
        </div>

        <div className="mt-4 min-h-0 flex-1">
          {loading ? (
            <div className="flex h-56 items-center justify-center rounded-lg border border-line bg-card text-sm text-ink-soft">
              Building your preview...
            </div>
          ) : error ? (
            <div role="alert" className="rounded-lg border border-line bg-card p-4 text-sm">
              <p className="text-postal-red">{error}</p>
              <p className="mt-1 text-ink-soft">
                You can still send your answer. Your asker receives it in the email either way.
              </p>
            </div>
          ) : pdfUrl && canEmbed ? (
            <iframe
              title="Preview of the PDF your asker will receive"
              src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
              className="h-[58vh] w-full rounded-lg border border-line bg-card"
            />
          ) : pdfUrl ? (
            <div className="flex flex-col items-center rounded-lg border border-line bg-card px-4 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lavender text-ink">
                <DocumentIcon className="h-6 w-6" />
              </span>
              <p className="mt-3 text-base font-semibold text-ink">Personalized Answer.pdf</p>
              <p className="mt-0.5 text-sm text-ink-soft">Your question, answer, and signature</p>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 rounded-full border border-ink px-5 py-2 text-sm font-medium text-ink hover:bg-ink hover:text-paper"
              >
                Open preview
              </a>
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-ink-soft">
          Your signature is added automatically.{" "}
          <Link
            href="/dashboard/settings"
            target="_blank"
            className="font-medium text-postal-blue underline decoration-line underline-offset-4 hover:text-ink"
          >
            Edit signature
          </Link>
        </p>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={backRef}
            type="button"
            disabled={sending}
            onClick={onBack}
            className="rounded-full border border-line px-5 py-2 text-sm font-medium text-ink hover:border-ink disabled:opacity-50"
          >
            Back to edit
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={sending || loading}
            onClick={onConfirm}
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-postal-blue disabled:opacity-50"
          >
            {sending ? "Sending..." : "Confirm & send"}
          </button>
        </div>
      </div>
    </div>
  )
}
