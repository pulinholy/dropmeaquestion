"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import ActiveStatusBanner from "../active-status-banner"

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState("")
  const [copied, setCopied] = useState(false)

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

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/${username}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
        <div className="mt-1 flex items-center gap-3">
          <p className="text-sm text-ink-soft">
            dropmeaquestion.com/{username}
          </p>
          <button
            onClick={copyLink}
            className="rounded-sm border border-line px-3 py-1 text-xs font-medium text-ink hover:bg-line"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      <ActiveStatusBanner />
    </div>
  )
}
