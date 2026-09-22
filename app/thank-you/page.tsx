"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"

type QuestionInfo = {
  questionId: string
  questionText: string
  expertName: string
  responseWindowHours: number | null
  hasAttachment: boolean
}

export default function ThankYouPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <SiteHeader variant="asker" />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <Suspense fallback={<p className="text-ink-soft">Confirming your payment...</p>}>
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

  const [status, setStatus] = useState<"loading" | "ready" | "timeout" | "error">("loading")
  const [info, setInfo] = useState<QuestionInfo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (!sessionId) {
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
      setStatus("error")
      return
    }

    if (data.pending) {
      if (attemptsRef.current >= 10) {
        setStatus("timeout")
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
    } else {
      setUploaded(true)
    }
    setUploading(false)
  }

  return (
    <>
      {status === "loading" && (
        <p className="text-ink-soft">Confirming your payment...</p>
      )}

      {status === "error" && (
        <>
          <h1 className="font-display text-3xl text-ink">Something went wrong</h1>
          <p className="mt-3 text-ink-soft">
            We couldn&apos;t confirm your payment. If you were charged, your
            question is still on its way — check your email.
          </p>
        </>
      )}

      {status === "timeout" && (
        <>
          <h1 className="font-display text-3xl text-ink">
            You&apos;re all set!
          </h1>
          <p className="mt-3 text-ink-soft">
            Your question is on its way. It&apos;s taking a little longer than
            usual to confirm, so attachments aren&apos;t available right now —
            you&apos;ll still get your answer by email.
          </p>
        </>
      )}

      {status === "ready" && info && (
        <>
          <h1 className="font-display text-3xl text-ink">
            You&apos;re all set!
          </h1>
          <p className="mt-3 text-ink-soft">
            Your question has been sent to{" "}
            {info.expertName.split(" ")[0] || info.expertName}.{" "}
            {info.responseWindowHours
              ? `They'll reply by email within ${info.responseWindowHours} hours.`
              : "They'll reply by email."}{" "}
            If they don&apos;t answer in time, you won&apos;t be charged.
          </p>
          <blockquote className="mt-4 w-full rounded-sm border border-line p-4 text-left text-sm text-ink-soft">
            {info.questionText}
          </blockquote>

          <div className="mt-8 w-full rounded-sm border border-line p-4 text-left">
            {uploaded ? (
              <p className="text-sm text-postal-blue">
                Attachment added — {info.expertName} will see it with your
                question.
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-ink">
                  Add a file (optional)
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  One image or PDF, up to 4MB — a screenshot, resume, or
                  anything that gives helpful context.
                </p>
                <label className="mt-3 inline-block cursor-pointer rounded-sm border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-line">
                  {uploading ? "Uploading..." : "Choose file"}
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp, application/pdf"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {uploadError && (
                  <p className="mt-2 text-sm text-postal-red">{uploadError}</p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
