"use client"

import { useEffect } from "react"

// Supabase's emailed links (confirm your email, reset a password) can land on
// the home page with the sign-in details in the address after the "#". The
// home page doesn't use them, so the person would just see the home page.
// Send them on to the page that does: confirming goes on to their dashboard
// (which finishes setting up their page), and a reset goes to the new-password
// form.
export default function AuthHashRedirect() {
  useEffect(() => {
    if (window.location.pathname !== "/") return
    const hash = window.location.hash

    // An emailed link that was already used or has expired.
    if (hash.includes("error_code=otp_expired")) {
      window.location.replace("/login?link=expired")
      return
    }

    if (!hash.includes("access_token=")) return

    const type = new URLSearchParams(hash.slice(1)).get("type")
    if (type === "signup") window.location.replace(`/auth/confirmed${hash}`)
    else if (type === "recovery") window.location.replace(`/reset-password${hash}`)
  }, [])

  return null
}
