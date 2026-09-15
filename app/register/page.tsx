"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [headline, setHeadline] = useState("")
  const [bio, setBio] = useState("")
  const [price, setPrice] = useState("10")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Step 1: create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError || !authData.user) {
      setError(authError?.message || "Something went wrong creating your account.")
      setLoading(false)
      return
    }

    const userId = authData.user.id

    // Step 2: create their profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: fullName,
      is_expert: true,
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    // Step 3: create their expert record
    const { error: expertError } = await supabase.from("experts").insert({
      id: userId,
      headline,
      bio,
      price_cents: Math.round(parseFloat(price) * 100),
    })

    if (expertError) {
      setError(expertError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    router.push("/register/success")
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-16">
      <h1 className="font-display text-3xl text-ink">Start your page</h1>
      <p className="mt-2 text-ink-soft">
        A few basics — you can add more later.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink">Full name</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">
            Headline (e.g. &quot;Senior iOS Developer, 8 yrs&quot;)
          </label>
          <input
            type="text"
            required
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Short bio</label>
          <textarea
            required
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">
            Price per question (USD)
          </label>
          <input
            type="number"
            required
            min="1"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
        </div>

        {error && <p className="text-sm text-postal-red">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-postal-blue disabled:opacity-50"
        >
          {loading ? "Creating your page..." : "Create My Page"}
        </button>
      </form>
    </main>
  )
}