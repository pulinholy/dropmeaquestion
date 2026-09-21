"use client"

import { createContext, useContext } from "react"

export type ProfileInfo = {
  fullName: string
  avatarUrl: string | null
}

export const ProfileContext = createContext<{
  profile: ProfileInfo
  refreshProfile: () => void
}>({
  profile: { fullName: "", avatarUrl: null },
  refreshProfile: () => {},
})

export function useProfileInfo() {
  return useContext(ProfileContext)
}
