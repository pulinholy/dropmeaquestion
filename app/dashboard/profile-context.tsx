"use client"

import { createContext, useContext } from "react"

export type ProfileInfo = {
  fullName: string
  username: string | null
  avatarUrl: string | null
}

export const ProfileContext = createContext<{
  profile: ProfileInfo
  refreshProfile: () => void
}>({
  profile: { fullName: "", username: null, avatarUrl: null },
  refreshProfile: () => {},
})

export function useProfileInfo() {
  return useContext(ProfileContext)
}
