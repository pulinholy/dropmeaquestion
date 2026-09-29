"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/reset-password` }
    )

    // Show the same confirmation either way -- don't reveal whether an
    // account exists for that email.
    if (resetError) {
      setError("Something went wrong. Please try again.")
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-display text-3xl text-ink">Reset your password</h1>

        {sent ? (
          <p className="mt-6 text-ink-soft">
            If an account exists for <span className="text-ink">{email}</span>,
            we&apos;ve sent a link to reset your password.
          </p>
        ) : (
          <>
            <p className="mt-2 text-ink-soft">
              Enter your email and we&apos;ll send you a link to reset it.
            </p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-medium text-ink">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
                />
              </div>
              {error && <p className="text-sm text-postal-red">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-postal-blue disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <a
          href="/login"
          className="mt-6 inline-block text-sm text-ink-soft hover:text-ink"
        >
          ← Back to log in
        </a>
      </div>

      <SiteFooter />
    </main>
  )
}
