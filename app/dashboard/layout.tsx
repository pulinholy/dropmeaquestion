"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { QuestionCountsContext, type QuestionCounts } from "./questions-context"
import { ProfileContext, type ProfileInfo } from "./profile-context"
import { ActiveStatusContext } from "./active-status-context"
import SiteFooter from "@/components/SiteFooter"
import {
  HomeIcon,
  ChatIcon,
  PersonIcon,
  TagIcon,
  SettingsIcon,
  StarIcon,
  MegaphoneIcon,
  VideoIcon,
  CreditCardIcon,
  LightbulbIcon,
  ExternalLinkIcon,
} from "@/components/icons"

const PRODUCT_FEEDBACK_HREF = `mailto:hello@dropmeaquestion.com?subject=${encodeURIComponent(
  "DMQ Product Feedback"
)}`

const yourPageLinks = [
  { href: "/dashboard/profile", label: "Profile", icon: PersonIcon },
  { href: "/dashboard/pricing", label: "Pricing", icon: TagIcon },
  { href: "/dashboard/settings", label: "Page settings", icon: SettingsIcon },
  { href: "/dashboard/feedback", label: "Feedback", icon: StarIcon },
  {
    href: "/dashboard/get-more-questions",
    label: "Share your page",
    icon: MegaphoneIcon,
  },
]

function HelpImproveLink() {
  return (
    <a
      href={PRODUCT_FEEDBACK_HREF}
      className="block rounded-sm border-t border-line px-2 pt-5 hover:bg-line/30"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-postal-blue">
        <LightbulbIcon className="h-4 w-4 flex-shrink-0 text-amber-500" />
        <span className="flex-1">Help improve DMQ</span>
        <ExternalLinkIcon className="h-3.5 w-3.5 flex-shrink-0 text-ink-soft" />
      </span>
      <span className="mt-1 block pl-6 text-xs text-ink-soft">
        Have an idea or found a problem? We&apos;d love to hear from you.
      </span>
    </a>
  )
}

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
    username: null,
    avatarUrl: null,
  })
  const [isActive, setIsActive] = useState(true)
  const [activeStatusLoading, setActiveStatusLoading] = useState(true)
  const [togglingActive, setTogglingActive] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)
  // "Conversations" only appears for experts who offer follow-up calls or
  // already have some; the count is requests waiting for them to confirm.
  const [followUpNav, setFollowUpNav] = useState({ visible: false, waiting: 0 })

  useEffect(() => {
    if (checkingSession) return
    let cancelled = false

    async function loadFollowUpNav() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) return
        const res = await fetch("/api/follow-up/mine", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        const calls: { status: string }[] = json.calls ?? []
        setFollowUpNav({
          visible: Boolean(json.available && (json.enabled || calls.length > 0)),
          waiting: calls.filter((c) => c.status === "requested").length,
        })
      } catch {
        // The menu item just stays hidden.
      }
    }

    loadFollowUpNav()
    return () => {
      cancelled = true
    }
  }, [checkingSession, pathname])

  useEffect(() => {
    // The admin's "Login as" link lands here with ?impersonated=1 -- stash
    // that in sessionStorage (survives client-side navigation within the
    // dashboard, gone the moment this tab closes) and strip it from the URL.
    if (typeof window !== "undefined") {
      if (new URLSearchParams(window.location.search).get("impersonated") === "1") {
        sessionStorage.setItem("dmq_impersonating", "true")
        window.history.replaceState(null, "", window.location.pathname)
      }
      if (sessionStorage.getItem("dmq_impersonating") === "true") {
        setIsImpersonating(true)
      }
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/login")
        return
      }

      // An admin deactivation bans the auth account, but an already-open
      // tab's session can outlive that until its token refreshes -- this
      // catches it immediately instead of waiting on that.
      const { data: expertRow } = await supabase
        .from("experts")
        .select("deactivated_at")
        .eq("id", data.session.user.id)
        .maybeSingle()

      if (expertRow?.deactivated_at) {
        await supabase.auth.signOut()
        router.push("/login")
        return
      }

      setCheckingSession(false)
      loadCounts()
      loadProfile()
      loadActiveStatus()
    })
  }, [router])

  async function loadProfile() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data } = await supabase
      .from("profiles")
      .select("full_name, username, avatar_url")
      .eq("id", userId)
      .single()

    if (data) {
      setProfile({
        fullName: data.full_name,
        username: data.username,
        avatarUrl: data.avatar_url,
      })
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  async function loadActiveStatus() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data } = await supabase
      .from("experts")
      .select("is_active")
      .eq("id", userId)
      .single()

    if (data) setIsActive(data.is_active)
    setActiveStatusLoading(false)
  }

  async function toggleActive() {
    setTogglingActive(true)
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setTogglingActive(false)
      return
    }

    const userId = sessionData.session.user.id
    const newValue = !isActive

    const { error } = await supabase
      .from("experts")
      .update({ is_active: newValue })
      .eq("id", userId)

    if (!error) setIsActive(newValue)
    setTogglingActive(false)
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
      <ActiveStatusContext.Provider
        value={{
          isActive,
          loading: activeStatusLoading,
          toggling: togglingActive,
          toggleActive,
        }}
      >
      <div className="flex min-h-screen flex-col bg-paper">
        <div className="h-1 w-full bg-postal-red" />

        {isImpersonating && (
          <div className="bg-amber-400 px-6 py-2 text-center text-sm font-medium text-ink">
            You&apos;re viewing as {profile.fullName || "this expert"} via
            admin login-as. Close this tab when you&apos;re done.
          </div>
        )}

        <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
          <a href="/" className="flex items-center">
            <img
              src="/brand/logo-icon.png"
              alt="Drop Me A Question"
              className="h-8 w-auto sm:hidden"
            />
            <img
              src="/brand/logo-lockup.png"
              alt="Drop Me A Question"
              className="hidden h-8 w-auto sm:block sm:h-9"
            />
          </a>
          <nav className="flex items-center gap-4">
            {profile.username && (
              <a
                href={`/${profile.username}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-2 text-sm font-medium text-ink hover:border-postal-red hover:text-postal-red"
              >
                View my page <span aria-hidden>↗</span>
              </a>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-ink-soft hover:text-ink"
            >
              Log out
            </button>
          </nav>
        </header>

        <div className="border-t border-line" />

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-8 sm:px-8 lg:flex-row lg:gap-12 lg:py-16">
        <nav className="flex flex-shrink-0 flex-col lg:w-60">
          <div className="mb-4 rounded-lg border border-line bg-card p-4 lg:mb-6">
            <div className="flex items-center gap-2">
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

            {!activeStatusLoading && (
              <button
                onClick={toggleActive}
                disabled={togglingActive}
                className="mt-3 flex w-full flex-col gap-1 rounded-sm px-1 py-1 text-left hover:bg-line/30 disabled:opacity-50"
              >
                <span className="flex items-start gap-1.5 text-xs text-ink-soft">
                  <span
                    className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      isActive ? "bg-green-500" : "bg-ink-soft/40"
                    }`}
                  />
                  <span>
                    {isActive
                      ? "Accepting questions"
                      : "Paused- not accepting questions"}
                  </span>
                </span>
                <span className="pl-3 text-xs font-medium text-postal-red">
                  {isActive ? "Pause" : "Resume"}
                </span>
              </button>
            )}
          </div>

          {/* Below lg the links become a horizontally scrolling tab row that
              bleeds to the screen edges; from lg up it's the vertical sidebar. */}
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:block lg:overflow-visible lg:p-0 [&::-webkit-scrollbar]:hidden">
            <Link
              href="/dashboard"
              className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium lg:mb-1 ${
                pathname === "/dashboard"
                  ? "bg-postal-red/10 text-postal-red"
                  : "text-ink-soft hover:bg-line/50 hover:text-ink"
              }`}
            >
              <HomeIcon className="h-4 w-4" />
              Home
            </Link>

            <Link
              href="/dashboard/questions/pending"
              className={`flex flex-shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ${
                followUpNav.visible ? "lg:mb-1" : "lg:mb-6"
              } ${
                pathname.startsWith("/dashboard/questions")
                  ? "bg-postal-red/10 text-postal-red"
                  : "text-ink-soft hover:bg-line/50 hover:text-ink"
              }`}
            >
              <span className="flex items-center gap-2">
                <ChatIcon className="h-4 w-4" />
                Questions
              </span>
              <span className="text-xs">{counts.pending}</span>
            </Link>

            {followUpNav.visible && (
              <Link
                href="/dashboard/conversations"
                className={`flex flex-shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium lg:mb-6 ${
                  pathname.startsWith("/dashboard/conversations")
                    ? "bg-postal-red/10 text-postal-red"
                    : "text-ink-soft hover:bg-line/50 hover:text-ink"
                }`}
              >
                <span className="flex items-center gap-2">
                  <VideoIcon className="h-4 w-4" />
                  Conversations
                </span>
                {followUpNav.waiting > 0 && (
                  <span className="rounded-full bg-postal-red px-1.5 text-[10px] font-semibold leading-4 text-white">
                    {followUpNav.waiting}
                  </span>
                )}
              </Link>
            )}

            <p className="hidden px-3 text-xs font-medium uppercase tracking-wide text-ink-soft/70 lg:block">
              Your page
            </p>
            <div className="flex gap-1 lg:mt-1 lg:block lg:space-y-0.5">
              {yourPageLinks.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ${
                      active
                        ? "bg-postal-red/10 text-postal-red"
                        : "text-ink-soft hover:bg-line/50 hover:text-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                )
              })}
            </div>

            <div className="flex lg:mt-6 lg:block lg:border-t lg:border-line lg:pt-6">
              <Link
                href="/dashboard/payments"
                className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ${
                  pathname.startsWith("/dashboard/payments")
                    ? "bg-postal-red/10 text-postal-red"
                    : "text-ink-soft hover:bg-line/50 hover:text-ink"
                }`}
              >
                <CreditCardIcon className="h-4 w-4" />
                Payments
              </Link>
            </div>
          </div>

          <div className="mt-auto hidden pt-10 lg:block">
            <HelpImproveLink />
          </div>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>

        <div className="lg:hidden">
          <HelpImproveLink />
        </div>
      </main>

        <SiteFooter />
      </div>
      </ActiveStatusContext.Provider>
      </ProfileContext.Provider>
    </QuestionCountsContext.Provider>
  )
}
