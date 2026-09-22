"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

const MIN_PRICE = 5

export default function PricingPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [price, setPrice] = useState("10")
  const [responseWindowHours, setResponseWindowHours] = useState("24")

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data: expert } = await supabase
      .from("experts")
      .select("price_cents, response_window_hours")
      .eq("id", userId)
      .single()

    if (expert) {
      setPrice((expert.price_cents / 100).toString())
      setResponseWindowHours(String(expert.response_window_hours))
    }
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError("")

    if (parseFloat(price) < MIN_PRICE) {
      setError(`Price per question must be at least $${MIN_PRICE}.`)
      setSaving(false)
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { error: updateError } = await supabase
      .from("experts")
      .update({
        price_cents: Math.round(parseFloat(price) * 100),
        response_window_hours: parseInt(responseWindowHours, 10),
      })
      .eq("id", userId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  return (
    <form onSubmit={handleSave} className="max-w-md space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink">
          {`Price per question (USD, $${MIN_PRICE} minimum)`}
        </label>
        <input
          type="number"
          required
          min={MIN_PRICE}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Answer within</label>
        <select
          value={responseWindowHours}
          onChange={(e) => setResponseWindowHours(e.target.value)}
          className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
        >
          <option value="24">24 hours</option>
          <option value="48">48 hours</option>
        </select>
      </div>

      {error && <p className="text-sm text-postal-red">{error}</p>}
      {saved && <p className="text-sm text-postal-blue">Saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-postal-blue disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </form>
  )
}
