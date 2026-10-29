"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { DocumentIcon } from "@/components/icons"
import {
  CLOSING_MAX,
  SIGNATURE_COLORS,
  SIGNATURE_NAME_MAX,
  SIGNATURE_TITLE_MAX,
  defaultSignature,
  normalizeSignature,
  type AnswerSignature,
  type SignatureColor,
} from "@/lib/answer-signature"

// The expert's answer signature: loaded with the rest of Page settings and
// saved by that page's one Save button.
export function useAnswerSignature(fullName: string) {
  const [available, setAvailable] = useState(false)
  const [value, setValue] = useState<AnswerSignature>(() => defaultSignature(fullName))

  const fetchSignature = useCallback(async (): Promise<AnswerSignature | null> => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return null
    // Fails harmlessly (the card stays hidden) before the database has the
    // new column.
    const { data, error } = await supabase
      .from("experts")
      .select("headline, answer_signature")
      .eq("id", sessionData.session.user.id)
      .maybeSingle()
    if (error || !data) return null
    return normalizeSignature(data.answer_signature, defaultSignature(fullName, data.headline))
  }, [fullName])

  useEffect(() => {
    let cancelled = false
    fetchSignature().then((v) => {
      if (cancelled || !v) return
      setValue(v)
      setAvailable(true)
    })
    return () => {
      cancelled = true
    }
  }, [fetchSignature])

  const reload = useCallback(async () => {
    const v = await fetchSignature()
    if (!v) return
    setValue(v)
    setAvailable(true)
  }, [fetchSignature])

  const problem = value.name.trim() ? "" : "Please enter the name to sign your answers with."

  // Returns an error message, or null when saved (or when there is nothing to save).
  async function save(): Promise<string | null> {
    if (!available) return null
    if (problem) return problem
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return "Please log in again."
    try {
      const res = await fetch("/api/save-signature", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ signature: value }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        return typeof data?.error === "string" ? data.error : "Could not save your signature."
      }
      return null
    } catch {
      return "Could not save your signature."
    }
  }

  return { available, value, setValue, reload, problem, save }
}

// How the signature looks at the end of an answer, in the email and the PDF.
export function SignaturePreview({ signature }: { signature: AnswerSignature }) {
  return (
    <div>
      <p className="text-sm text-ink">{signature.closing}</p>
      <p
        className={`mt-1 text-lg italic ${signature.boldName ? "font-bold" : "font-normal"}`}
        style={{ color: SIGNATURE_COLORS[signature.color].hex }}
      >
        {signature.name || "Your name"}
      </p>
      {signature.title && <p className="mt-0.5 text-xs text-ink-soft">{signature.title}</p>}
    </div>
  )
}

export default function AnswerSignatureCard({
  form,
}: {
  form: ReturnType<typeof useAnswerSignature>
}) {
  const { available, value, setValue, problem } = form
  if (!available) return null

  function set<K extends keyof AnswerSignature>(key: K, next: AnswerSignature[K]) {
    setValue({ ...value, [key]: next })
  }

  const chip = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-ink bg-white text-ink"
        : "border-line bg-white text-ink-soft hover:border-ink hover:text-ink"
    }`

  const inputClass =
    "mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink"

  return (
    <div className="mt-4 rounded-lg border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
          <DocumentIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">Answer signature</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Added at the end of every answer you send, in the email and on the PDF your asker can
            download. Set it once and it&apos;s used each time.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0">
          <label htmlFor="sig-closing" className="block text-xs font-semibold text-ink">
            Closing message
          </label>
          <input
            id="sig-closing"
            type="text"
            maxLength={CLOSING_MAX}
            value={value.closing}
            onChange={(e) => set("closing", e.target.value)}
            placeholder="Best wishes,"
            className={inputClass}
          />

          <label htmlFor="sig-name" className="mt-4 block text-xs font-semibold text-ink">
            Display name
          </label>
          <input
            id="sig-name"
            type="text"
            maxLength={SIGNATURE_NAME_MAX}
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            className={inputClass}
          />

          <label htmlFor="sig-title" className="mt-4 block text-xs font-semibold text-ink">
            Professional title <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <input
            id="sig-title"
            type="text"
            maxLength={SIGNATURE_TITLE_MAX}
            value={value.title}
            onChange={(e) => set("title", e.target.value)}
            className={inputClass}
          />

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={value.boldName}
                onChange={(e) => set("boldName", e.target.checked)}
                className="h-4 w-4 accent-ink"
              />
              Bold name
            </label>
            <div role="radiogroup" aria-label="Name colour" className="flex flex-wrap gap-2">
              {(Object.keys(SIGNATURE_COLORS) as SignatureColor[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={value.color === key}
                  onClick={() => set("color", key)}
                  className={chip(value.color === key)}
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: SIGNATURE_COLORS[key].hex }}
                  />
                  {SIGNATURE_COLORS[key].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-line bg-white p-4">
          <p className="text-xs text-ink-soft">Signature preview</p>
          <div className="mt-3">
            <SignaturePreview signature={value} />
          </div>
        </div>
      </div>

      {problem && <p className="mt-3 text-sm text-postal-red">{problem}</p>}
    </div>
  )
}
