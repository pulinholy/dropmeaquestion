"use client"

import { createContext, useContext } from "react"

export type ActiveStatusValue = {
  isActive: boolean
  loading: boolean
  toggling: boolean
  toggleActive: () => void
}

export const ActiveStatusContext = createContext<ActiveStatusValue>({
  isActive: true,
  loading: true,
  toggling: false,
  toggleActive: () => {},
})

export function useActiveStatus() {
  return useContext(ActiveStatusContext)
}
