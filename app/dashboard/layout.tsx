"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { QuestionCountsContext, type QuestionCounts } from "./questions-context"
import { ProfileContext, type ProfileInfo } from "./profile-context"

const questionTabs = [
  { href: "/dashboard/questions/pending", label: "Pending", key: "pending" as const },
  { href: "/dashboard/questions/answered", label: "Answered", key: "answered" as const },
  { href: "/dashboard/questions/declined", label: "Declined", key: "declined" as const },
  { href: "/dashboard/questions/expired", label: "Expired", key: "expired" as const },
]

const otherLinks = [
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/pricing", label: "Pricing" },
  { href: "/dashboard/payments", label: "Payments" },
  { href: "/dashboard/settings", label: "Page settings" },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [checkingSession, setCheckingSession] = useState(true)
  const [counts, setCounts] = useState<QuestionCounts>({
    pending: 0,
    answered: 0,
    declined: 0,
    expired: 0,
  })
  const [profile, setProfile] = useState<ProfileInfo>({
    fullName: "",
    avatarUrl: null,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login")
        return
      }
      setCheckingSession(false)
      loadCounts()
      loadProfile()
    })
  }, [router])

  async function loadProfile() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userId)
      .single()

    if (data) {
      setProfile({ fullName: data.full_name, avatarUrl: data.avatar_url })
    }
  }

  async function loadCounts() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data } = await supabase
      .from("questions")
      .select("status")
      .eq("expert_id", userId)

    const next: QuestionCounts = { pending: 0, answered: 0, declined: 0, expired: 0 }
    ;(data ?? []).forEach((q) => {
      if (q.status === "pending") next.pending++
      else if (q.status === "answered") next.answered++
      else if (q.status === "declined") next.declined++
      else if (q.status === "expired") next.expired++
    })
    setCounts(next)
  }

  if (checkingSession) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-ink-soft">Loading...</p>
      </main>
    )
  }

  return (
    <QuestionCountsContext.Provider value={{ counts, refreshCounts: loadCounts }}>
      <ProfileContext.Provider value={{ profile, refreshProfile: loadProfile }}>
      <main className="mx-auto flex max-w-4xl gap-12 px-6 py-16">
        <nav className="w-48 flex-shrink-0">
          <div className="mb-6 flex items-center gap-2 border-b border-line pb-6">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.fullName}
                className="h-9 w-9 flex-shrink-0 rounded-full border border-line object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line bg-line/40 text-sm font-medium text-ink-soft">
                {profile.fullName.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <p className="truncate text-sm font-medium text-ink">
              {profile.fullName}
            </p>
          </div>

          <p className="px-3 text-sm font-medium text-ink">Questions</p>
          <div className="mt-1 space-y-0.5">
            {questionTabs.map((tab) => {
              const active = pathname === tab.href
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`block rounded-sm py-1.5 pl-6 pr-3 text-sm ${
                    active
                      ? "bg-postal-red/10 text-postal-red"
                      : "text-ink-soft hover:bg-line/50 hover:text-ink"
                  }`}
                >
                  {tab.label} ({counts[tab.key]})
                </Link>
              )
            })}
          </div>

          <div className="mt-6 space-y-0.5 border-t border-line pt-6">
            {otherLinks.map((link) => {
              const active = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-sm px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-postal-red/10 text-postal-red"
                      : "text-ink-soft hover:bg-line/50 hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </main>
      </ProfileContext.Provider>
    </QuestionCountsContext.Provider>
  )
}
