"use client"

import { createContext, useContext } from "react"
import { FOLLOW_UP_DURATION_MINUTES } from "@/lib/follow-up-rules"

// What the dashboard shows about follow-up conversations outside the
// Conversations page itself: the sidebar count and the home page card.
//   requests  asked for, waiting for the expert to confirm (needs action)
//   upcoming  confirmed and not over yet
// Anything finished, cancelled or under review is closed and isn't counted.
export type ConversationSummary = {
  // Whether the expert uses follow-up conversations at all.
  visible: boolean
  requests: number
  upcoming: number
  // The start of the next upcoming conversation, if any.
  nextStart: string | null
}

export const EMPTY_CONVERSATION_SUMMARY: ConversationSummary = {
  visible: false,
  requests: 0,
  upcoming: 0,
  nextStart: null,
}

export const ConversationSummaryContext = createContext<ConversationSummary>(
  EMPTY_CONVERSATION_SUMMARY
)

export function useConversationSummary() {
  return useContext(ConversationSummaryContext)
}

export function summarizeConversations(
  calls: { status: string; confirmedStart: string | null }[],
  now: number = Date.now()
): Pick<ConversationSummary, "requests" | "upcoming" | "nextStart"> {
  const slotMs = FOLLOW_UP_DURATION_MINUTES * 60 * 1000
  const upcoming = calls
    .filter(
      (c) =>
        c.status === "confirmed" &&
        c.confirmedStart !== null &&
        new Date(c.confirmedStart).getTime() + slotMs > now
    )
    .sort(
      (a, b) =>
        new Date(a.confirmedStart as string).getTime() -
        new Date(b.confirmedStart as string).getTime()
    )
  return {
    requests: calls.filter((c) => c.status === "requested").length,
    upcoming: upcoming.length,
    nextStart: upcoming[0]?.confirmedStart ?? null,
  }
}
