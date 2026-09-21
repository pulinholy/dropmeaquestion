"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function ActiveStatusBanner() {
  const [loading, setLoading] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [togglingActive, setTogglingActive] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data: expert } = await supabase
      .from("experts")
      .select("is_active")
      .eq("id", userId)
      .single()

    if (expert) setIsActive(expert.is_active)
    setLoading(false)
  }

  async function toggleActive() {
    setTogglingActive(true)
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      console.error("No valid user session:", userError)
      setTogglingActive(false)
      return
    }

    const userId = userData.user.id
    const newValue = !isActive

    const { error } = await supabase
      .from("experts")
      .update({ is_active: newValue })
      .eq("id", userId)

    if (error) {
      console.error("Toggle active error:", error)
    } else {
      setIsActive(newValue)
    }

    setTogglingActive(false)
  }

  if (loading) return null

  return (
    <div className="mb-6 flex items-center justify-between rounded-sm border border-line p-4">
      <div>
        <p className="text-sm font-medium text-ink">
          {isActive ? "Currently accepting questions" : "Paused — not accepting questions"}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {isActive
            ? "Visitors can drop you a question right now."
            : "Your page shows a friendly away message instead of the form."}
        </p>
      </div>
      <button
        onClick={toggleActive}
        disabled={togglingActive}
        className="rounded-sm border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-line disabled:opacity-50"
      >
        {isActive ? "Pause" : "Resume"}
      </button>
    </div>
  )
}
