"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ActiveStatusBanner from "../active-status-banner"

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState("")

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single()

    if (profile) setUsername(profile.username)
    setLoading(false)
  }

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <label className="block text-sm font-medium text-ink">
          Your page link
        </label>
        <p className="mt-1 text-sm text-ink-soft">
          dropmeaquestion.com/{username}
        </p>
      </div>

      <ActiveStatusBanner />
    </div>
  )
}
