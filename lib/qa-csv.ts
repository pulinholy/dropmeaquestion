export type QaRow = {
  reference_id: string | null
  created_at: string
  answered_at: string | null
  question_text: string
  answer_text: string | null
  // Only set when the asker chose to share it with this expert.
  shared_email?: string | null
}

// Question text is typed by strangers, so a cell that starts with = + - or @
// would run as a formula when the expert opens the file in a spreadsheet.
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

function day(dateStr: string | null): string {
  if (!dateStr) return ""
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : `${dateStr}Z`
  return new Date(iso).toISOString().slice(0, 10)
}

// An email appears only on rows where the asker shared it with the expert.
export function buildQaCsv(rows: QaRow[]): string {
  const header = ["Question ID", "Asked", "Answered", "Question", "Answer", "Shared email"]
  const lines = rows.map((r) =>
    [
      cell(r.reference_id ? `#${r.reference_id}` : ""),
      cell(day(r.created_at)),
      cell(day(r.answered_at)),
      cell(r.question_text ?? ""),
      cell(r.answer_text ?? ""),
      cell(r.shared_email ?? ""),
    ].join(",")
  )
  // The leading BOM makes Excel read the file as UTF-8.
  return "﻿" + [header.map(cell).join(","), ...lines].join("\r\n")
}
