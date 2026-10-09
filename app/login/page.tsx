"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  // Offered when the email isn't confirmed yet, or when an emailed link was
  // already used or has expired.
  const [offerResend, setOfferResend] = useState(false)
  const [linkNotice, setLinkNotice] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState("")

  useEffect(() => {
    const t = setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("link") === "expired") {
        setLinkNotice(true)
        setOfferResend(true)
      }
    }, 0)
    return () => clearTimeout(t)
  }, [])

  async function handleResend() {
    const typed = email.trim().toLowerCase()
    if (!typed) {
      setResendMessage("Enter your email address above first.")
      return
    }
    setResending(true)
    setResendMessage("")
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: typed,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` },
    })
    setResending(false)
    if (resendError) {
      setResendMessage(
        /rate|seconds|too many/i.test(resendError.message)
          ? "Please wait a minute before asking for another email."
          : "We couldn't send that email. Please try again in a moment."
      )
      return
    }
    setResendMessage(
      "If that address has an account waiting to be confirmed, we've sent a new confirmation email. Use the newest link in it, and check your spam folder."
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (loginError) {
      setError(loginError.message)
      if (/not confirmed/i.test(loginError.message)) setOfferResend(true)
      setLoading(false)
      return
    }

    router.push("/dashboard")
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-display text-3xl text-ink">Log in</h1>
        {linkNotice && (
          <p className="mt-4 rounded-sm border border-line bg-white p-3 text-sm text-ink-soft">
            That email link has already been used or has expired. If you&apos;ve already confirmed
            your email, log in below. If not, enter your email and ask for a new one.
          </p>
        )}
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
            <div className="flex items-baseline justify-between">
              <label className="block text-sm font-medium text-ink">
                Password
              </label>
              <a
                href="/forgot-password"
                className="text-xs text-ink-soft hover:text-ink"
              >
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
            />
          </div>
          {error && <p className="text-sm text-postal-red">{error}</p>}
          {offerResend && (
            <div className="rounded-sm border border-line bg-white p-3 text-sm text-ink-soft">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="font-medium text-ink underline underline-offset-2 disabled:opacity-50"
              >
                {resending ? "Sending..." : "Resend confirmation email"}
              </button>
              {resendMessage && <p className="mt-2">{resendMessage}</p>}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-postal-blue disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>

      <SiteFooter />
    </main>
  )
}