"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { DocumentIcon } from "@/components/icons"
import {
  GUIDANCE_MAX,
  QUESTION_TEMPLATES,
  STARTER_MAX,
  checkQuestionFormText,
} from "@/lib/question-form"

export type QuestionFormValue = {
  guidance: string
  starter: string
  // Whether the note and starter text show on the expert's page. The text is
  // kept when this is off, so turning it back on remembers it.
  enabled: boolean
  templateId: string | null
}

const EMPTY: QuestionFormValue = { guidance: "", starter: "", enabled: true, templateId: null }

// The expert's question-form settings: loaded with the rest of Page settings
// and saved by that page's one Save button.
export function useQuestionForm() {
  const [available, setAvailable] = useState(false)
  const [value, setValue] = useState<QuestionFormValue>(EMPTY)

  const fetchForm = useCallback(async (): Promise<QuestionFormValue | null> => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return null
    const userId = sessionData.session.user.id
    // Fails harmlessly (the card stays hidden) before the database has the
    // new columns.
    const { data, error } = await supabase
      .from("experts")
      .select("question_guidance, question_template")
      .eq("id", userId)
      .maybeSingle()
    if (error || !data) return null
    // A separate read, so this still works before the on/off column exists.
    const { data: flag } = await supabase
      .from("experts")
      .select("question_form_enabled")
      .eq("id", userId)
      .maybeSingle()
    return {
      guidance: data.question_guidance ?? "",
      starter: data.question_template ?? "",
      enabled: flag?.question_form_enabled !== false,
      templateId: null,
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchForm().then((v) => {
      if (cancelled || !v) return
      setValue(v)
      setAvailable(true)
    })
    return () => {
      cancelled = true
    }
  }, [fetchForm])

  const reload = useCallback(async () => {
    const v = await fetchForm()
    if (!v) return
    setValue(v)
    setAvailable(true)
  }, [fetchForm])

  const guidanceCheck = checkQuestionFormText(value.guidance, GUIDANCE_MAX, "What to include")
  const starterCheck = checkQuestionFormText(value.starter, STARTER_MAX, "Starter text")
  const problem =
    (!guidanceCheck.ok && guidanceCheck.message) || (!starterCheck.ok && starterCheck.message) || ""

  // Returns an error message, or null when saved (or when there is nothing to save).
  async function save(): Promise<string | null> {
    if (!available) return null
    if (problem) return problem
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return "Please log in again."
    try {
      const res = await fetch("/api/save-question-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          guidance: value.guidance,
          starter: value.starter,
          enabled: value.enabled,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        return typeof data?.error === "string" ? data.error : "Could not save the question form."
      }
      return null
    } catch {
      return "Could not save the question form."
    }
  }

  return { available, value, setValue, reload, problem, save }
}

// The full-width "Question form" card: templates and the note on the left,
// starter text in the middle, and what askers will see on the right.
export default function QuestionFormCard({
  form,
  firstName,
}: {
  form: ReturnType<typeof useQuestionForm>
  firstName: string
}) {
  const { available, value, setValue, problem } = form
  if (!available) return null

  const off = !value.enabled

  function pickTemplate(id: string | null) {
    const t = QUESTION_TEMPLATES.find((x) => x.id === id)
    setValue({ ...value, templateId: id, guidance: t ? t.guidance : "", starter: t ? t.starter : "" })
  }

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
      active
        ? "border-ink bg-white text-ink"
        : "border-line bg-white text-ink-soft hover:border-ink hover:text-ink"
    }`

  return (
    <div className="mt-4 rounded-lg border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
            <DocumentIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">
              Question form <span className="font-normal text-ink-soft">(optional)</span>
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              Help askers write a question you can answer well. This is optional; until you save
              something, your page is unchanged.
            </p>
          </div>
        </div>
        <label className="flex flex-shrink-0 cursor-pointer items-center gap-3 text-right">
          <span>
            <span className="block text-xs font-semibold text-ink">Show question form on my page</span>
            <span className="block text-[11px] text-ink-soft">Display helpful prompts to askers</span>
          </span>
          <span className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) => setValue({ ...value, enabled: e.target.checked })}
              className="peer sr-only"
            />
            <span className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-green-500" />
            <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
          </span>
        </label>
      </div>

      <div
        className={`mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_0.8fr_1fr] ${off ? "opacity-60" : ""}`}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink">Start from a template</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUESTION_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={off}
                onClick={() => pickTemplate(t.id)}
                className={chip(value.templateId === t.id)}
              >
                {t.label}
              </button>
            ))}
            <button type="button" disabled={off} onClick={() => pickTemplate(null)} className={chip(false)}>
              Blank
            </button>
          </div>

          <label htmlFor="qf-guidance" className="mt-4 block text-xs font-semibold text-ink">
            What to include
          </label>
          <textarea
            id="qf-guidance"
            rows={4}
            disabled={off}
            value={value.guidance}
            onChange={(e) => setValue({ ...value, guidance: e.target.value })}
            className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink disabled:bg-line/20"
          />
          <p className="mt-1 text-xs text-ink-soft">
            Shown under the question box. {value.guidance.length} of {GUIDANCE_MAX} characters.
          </p>
        </div>

        <div className="min-w-0">
          <label htmlFor="qf-starter" className="block text-xs font-semibold text-ink">
            Starter text (optional)
          </label>
          <textarea
            id="qf-starter"
            rows={6}
            disabled={off}
            value={value.starter}
            onChange={(e) => setValue({ ...value, starter: e.target.value })}
            className="mt-2 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink disabled:bg-line/20"
          />
          <p className="mt-1 text-xs text-ink-soft">
            Pre-fills the question box. Askers can edit it or start blank. {value.starter.length} of{" "}
            {STARTER_MAX} characters.
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            Links, email addresses, and phone numbers aren&apos;t allowed here. Askers&apos; contact
            details stay private.
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-line bg-white p-4">
          <p className="text-xs text-ink-soft">What askers will see</p>
          {off ? (
            <p className="mt-3 text-sm text-ink-soft">
              The question form is off. Askers see the standard question box.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm font-semibold text-ink">
                What would you like to ask {firstName}?
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-soft">
                {value.guidance.trim() ||
                  "For the best answer, focus on one main question and include any helpful context."}
              </p>
              <div className="mt-2 min-h-[5rem] whitespace-pre-wrap rounded-sm border border-line bg-line/10 px-3 py-2 text-sm text-ink">
                {value.starter.trim()}
              </div>
            </>
          )}
        </div>
      </div>

      {problem && <p className="mt-3 text-sm text-postal-red">{problem}</p>}
    </div>
  )
}
