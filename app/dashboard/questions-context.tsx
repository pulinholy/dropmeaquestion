"use client"

import { createContext, useContext } from "react"

export type QuestionCounts = {
  pending: number
  answered: number
  declined: number
  expired: number
}

export const QuestionCountsContext = createContext<{
  counts: QuestionCounts
  refreshCounts: () => void
}>({
  counts: { pending: 0, answered: 0, declined: 0, expired: 0 },
  refreshCounts: () => {},
})

export function useQuestionCounts() {
  return useContext(QuestionCountsContext)
}
