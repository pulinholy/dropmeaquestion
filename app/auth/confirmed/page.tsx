"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"

// Where the "confirm your email" link lands. Opening it signs the person in;
// the dashboard then creates the page they filled in at registration.
export default function EmailConfirmedPage() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Waits for the sign-in details in the address to be read.
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      router.replace(data.session ? "/dashboard" : "/login")
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <main className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-ink">Email confirmed</h1>
        <p className="mt-3 text-ink-soft">Setting up your page...</p>
      </div>
      <SiteFooter />
    </main>
  )
}
