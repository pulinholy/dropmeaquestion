"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (loginError || !data.session) {
      setError(loginError?.message || "Login failed.")
      setLoading(false)
      return
    }

    const res = await fetch("/api/admin/whoami", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    })
    const whoami = await res.json()

    if (!whoami.isAdmin) {
      await supabase.auth.signOut()
      setError("This account does not have admin access.")
      setLoading(false)
      return
    }

    router.push("/admin")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="w-full max-w-sm rounded-lg border border-line bg-paper p-8">
        <h1 className="font-display text-2xl text-ink">Admin Login</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            <label className="block text-sm font-medium text-ink">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
            />
          </div>
          {error && <p className="text-sm text-postal-red">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-postal-blue disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </main>
  )
}
