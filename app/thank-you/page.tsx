"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import { formatResponseWindow } from "@/lib/format"
import { CheckIcon, DocumentIcon, PaperclipIcon, UploadIcon, XIcon } from "@/components/icons"

type QuestionInfo = {
  questionId: string
  questionText: string
  expertName: string
  expertUsername: string | null
  responseWindowHours: number | null
  hasAttachment: boolean
  askedAt: string | null
}

type FileMeta = { name: string; size: number }

const MAX_POLL_ATTEMPTS = 20 // ~30s at 1.5s intervals
const QUESTION_PREVIEW_LENGTH = 220

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatAskedDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// A calm, restrained badge shared by every state -- a spinner while we wait,
// a checkmark once confirmed. Kept as one component so the hero area doesn't
// jump around as status changes.
function StatusBadge({ state }: { state: "pending" | "success" | "error" }) {
  if (state === "pending") {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-line/40">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink-soft border-t-transparent" />
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-postal-red/10">
        <XIcon className="h-6 w-6 text-postal-red" />
      </div>
    )
  }

  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <span className="absolute -left-3 -top-1 h-3 w-0.5 rotate-45 rounded-full bg-postal-red/40" />
      <span className="absolute -right-3 -top-1 h-3 w-0.5 -rotate-45 rounded-full bg-line" />
      <span className="absolute -left-2 bottom-0 h-3 w-0.5 -rotate-45 rounded-full bg-line" />
      <span className="absolute -right-2 bottom-0 h-3 w-0.5 rotate-45 rounded-full bg-postal-red/40" />
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
        <CheckIcon className="h-7 w-7 text-green-700" />
      </div>
    </div>
  )
}

export default function ThankYouPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <SiteHeader variant="asker" />

      <div className="mx-auto flex w-full max-w-[540px] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <Suspense
          fallback={
            <>
              <StatusBadge state="pending" />
              <h1 className="mt-6 font-display text-3xl text-ink">
                Confirming your question...
              </h1>
            </>
          }
        >
          <ThankYouContent />
        </Suspense>
      </div>

      <SiteFooter />
    </main>
  )
}

function ThankYouContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")

  const [status, setStatus] = useState<"loading" | "confirming" | "ready" | "error">(
    "loading"
  )
  const [errorMessage, setErrorMessage] = useState("")
  const [slow, setSlow] = useState(false)
  const [info, setInfo] = useState<QuestionInfo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null)
  const [questionExpanded, setQuestionExpanded] = useState(false)
  const attemptsRef = useRef(0)

  const expertFirstName = info?.expertName.split(" ")[0] || info?.expertName || "the expert"

  useEffect(() => {
    if (!sessionId) {
      setErrorMessage(
        "We couldn't find your payment. If you were charged, check your email — you'll still get an answer."
      )
      setStatus("error")
      return
    }
    poll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function poll() {
    attemptsRef.current += 1

    const res = await fetch(`/api/stripe/get-question-by-session?session_id=${sessionId}`)
    const data = await res.json()

    if (data.error) {
      setErrorMessage(data.error)
      setStatus("error")
      return
    }

    if (data.pending) {
      setStatus("confirming")
      if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
        // Stop polling rather than claim success we can't back up.
        // Reconciliation will finish confirming it and email the asker.
        setSlow(true)
        return
      }
      setTimeout(poll, 1500)
      return
    }

    setInfo(data)
    setUploaded(data.hasAttachment)
    setStatus("ready")
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !sessionId) return

    setUploadError("")
    setFileMeta({ name: file.name, size: file.size })
    setUploading(true)

    const formData = new FormData()
    formData.append("sessionId", sessionId)
    formData.append("file", file)

    const res = await fetch("/api/upload-attachment", {
      method: "POST",
      body: formData,
    })
    const data = await res.json()

    if (data.error) {
      setUploadError(data.error)
      setUploaded(false)
    } else {
      setUploaded(true)
    }
    setUploading(false)
  }

  function handleRemove() {
    setFileMeta(null)
    setUploaded(false)
    setUploadError("")
  }

  const questionText = info?.questionText ?? ""
  const isLongQuestion = questionText.length > QUESTION_PREVIEW_LENGTH
  const displayedQuestion =
    isLongQuestion && !questionExpanded
      ? `${questionText.slice(0, QUESTION_PREVIEW_LENGTH).trimEnd()}…`
      : questionText

  return (
    <>
      {(status === "loading" || status === "confirming") && (
        <>
          <StatusBadge state="pending" />
          <h1 className="mt-6 font-display text-3xl text-ink">
            Confirming your question...
          </h1>
          <p className="mt-3 text-ink-soft">
            {slow
              ? "This is taking longer than usual, but don't worry — we'll email you as soon as your question is confirmed."
              : "Your payment was completed. We're confirming your question with DMQ. This usually takes just a moment."}
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <StatusBadge state="error" />
          <h1 className="mt-6 font-display text-3xl text-ink">
            We couldn&apos;t confirm your question
          </h1>
          <p className="mt-3 text-ink-soft">{errorMessage}</p>
        </>
      )}

      {status === "ready" && info && (
        <>
          <StatusBadge state="success" />
          <h1 className="mt-6 font-display text-3xl text-ink">
            Your question is sent!
          </h1>
          <p className="mt-3 font-semibold text-ink">
            {expertFirstName} will respond
            {info.responseWindowHours
              ? ` within ${formatResponseWindow(info.responseWindowHours)}.`
              : " by email."}
          </p>
          <p className="mt-1 text-ink-soft">
            We&apos;ll email you when your answer is ready. If {expertFirstName} doesn&apos;t
            respond in time, you won&apos;t be charged.
          </p>

          <div className="mt-8 w-full rounded-lg border border-line bg-white p-5 text-left shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Your question
              </p>
              {formatAskedDate(info.askedAt) && (
                <p className="flex-shrink-0 text-xs text-ink-soft">
                  Asked {expertFirstName} · {formatAskedDate(info.askedAt)}
                </p>
              )}
            </div>
            <div className="mt-3 rounded-md bg-line/25 p-4">
              <p className="whitespace-pre-wrap text-sm text-ink">{displayedQuestion}</p>
              {isLongQuestion && (
                <button
                  type="button"
                  onClick={() => setQuestionExpanded((v) => !v)}
                  className="mt-2 text-xs font-medium text-postal-red hover:underline"
                >
                  {questionExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 w-full rounded-lg border border-postal-red/20 bg-postal-red/5 p-5 text-left shadow-sm sm:p-6">
            {uploaded || uploading || uploadError ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-green-600/20 bg-green-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-ink-soft shadow-sm">
                    <DocumentIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {fileMeta?.name ?? "Your attachment"}
                    </p>
                    {uploading && (
                      <p className="text-xs text-ink-soft">
                        {fileMeta && `${formatFileSize(fileMeta.size)} · `}Uploading...
                      </p>
                    )}
                    {uploaded && !uploading && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                        <span className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                          <CheckIcon className="h-2.5 w-2.5" />
                        </span>
                        Attached successfully
                      </p>
                    )}
                    {uploadError && (
                      <p className="text-xs text-postal-red">{uploadError}</p>
                    )}
                  </div>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="flex-shrink-0 text-xs text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
                  >
                    Remove
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-postal-red/10 text-postal-red">
                    <PaperclipIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Want to add more context?{" "}
                      <span className="font-normal text-ink-soft">(optional)</span>
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                      Attach a screenshot, image, or PDF if it would help {expertFirstName}{" "}
                      better understand your question.
                    </p>
                  </div>
                </div>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-postal-red/30 bg-white/60 px-4 py-6 text-center hover:bg-white">
                  <span className="inline-flex items-center gap-2 rounded-full bg-postal-red px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink">
                    <UploadIcon className="h-4 w-4" />
                    Choose a file
                  </span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp, application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="mt-2 text-center text-xs text-ink-soft">
                  Image or PDF · Maximum 4MB · One file only
                </p>
              </>
            )}
          </div>

          {info.expertUsername && (
            <a
              href={`/${info.expertUsername}`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink"
            >
              Ask {expertFirstName} another question <span aria-hidden>→</span>
            </a>
          )}
        </>
      )}
    </>
  )
}
