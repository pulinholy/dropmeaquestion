"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { UsersIcon, VideoIcon } from "@/components/icons"

const adminLinks = [
  { href: "/admin", label: "Experts", icon: UsersIcon },
  { href: "/admin/conversations", label: "Conversations", icon: VideoIcon },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function check() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push("/admin/login")
      return
    }

    const res = await fetch("/api/admin/whoami", {
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    })
    const whoami = await res.json()

    if (!whoami.isAdmin) {
      router.push("/admin/login")
      return
    }

    setEmail(whoami.email)
    setChecking(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/admin/login")
  }

  if (checking) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-ink-soft">Loading...</p>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="h-1 w-full bg-ink" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <p className="font-display text-lg text-ink">DMQ Admin</p>
        <nav className="flex items-center gap-4">
          <span className="text-sm text-ink-soft">{email}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-ink-soft hover:text-ink"
          >
            Log out
          </button>
        </nav>
      </header>

      <div className="border-t border-line" />

      <main className="mx-auto flex w-full max-w-6xl flex-1 gap-12 px-6 py-10">
        <nav className="w-48 flex-shrink-0 space-y-0.5">
          {adminLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-ink/10 text-ink"
                    : "text-ink-soft hover:bg-line/50 hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </main>
    </div>
  )
}
