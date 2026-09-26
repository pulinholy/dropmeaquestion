"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useProfileInfo } from "../profile-context"
import {
  ClockIcon,
  DocumentIcon,
  DownloadIcon,
  FacebookBadgeIcon,
  InstagramBadgeIcon,
  LightbulbIcon,
  LinkedInBadgeIcon,
  LinkIcon,
  MailIcon,
  MegaphoneIcon,
  PersonIcon,
  TagIcon,
  TargetIcon,
  TikTokBadgeIcon,
  XBadgeIcon,
  YouTubeBadgeIcon,
} from "@/components/icons"

type IconComponent = (props: { className?: string }) => React.ReactElement

function joinWithOr(items: string[]): string {
  if (items.length === 0) return "my area of expertise"
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} or ${items[1]}`
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`
}

const moreWays = [
  {
    icon: TargetIcon,
    iconBg: "bg-postal-red/10",
    iconText: "text-postal-red",
    title: "Make your expertise specific",
    description: "Add clear topics so people know what they can ask you.",
    cta: "Edit my topics",
    href: "/dashboard/profile",
  },
  {
    icon: PersonIcon,
    iconBg: "bg-postal-blue/10",
    iconText: "text-postal-blue",
    title: "Keep your profile up to date",
    description:
      "A clear photo, professional title and bio help people trust your expertise.",
    cta: "Edit profile",
    href: "/dashboard/profile",
  },
  {
    icon: TagIcon,
    iconBg: "bg-green-500/10",
    iconText: "text-green-700",
    title: "Set a price that fits your expertise",
    description:
      "Choose a price you're comfortable with. You can change it anytime.",
    cta: "Review pricing",
    href: "/dashboard/pricing",
  },
  {
    icon: ClockIcon,
    iconBg: "bg-lavender",
    iconText: "text-ink",
    title: "Answer consistently",
    description:
      "Respond within your selected time. A good experience makes people more likely to ask you again.",
    cta: null,
    href: null,
  },
] as const

export default function GetMoreQuestionsPage() {
  const { profile } = useProfileInfo()
  const [topics, setTopics] = useState<string[]>([])
  const [headline, setHeadline] = useState("")
  const [copiedLink, setCopiedLink] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<"professional" | "casual">(
    "professional"
  )
  const [copiedTemplate, setCopiedTemplate] = useState(false)

  useEffect(() => {
    loadTopics()
  }, [])

  async function loadTopics() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data } = await supabase
      .from("expert_topics")
      .select("name")
      .eq("expert_id", userId)
      .order("sort_order", { ascending: true })

    setTopics((data ?? []).map((t) => t.name))

    const { data: expert } = await supabase
      .from("experts")
      .select("headline")
      .eq("id", userId)
      .single()

    setHeadline(expert?.headline ?? "")
  }

  const pageUrl = profile.username
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${profile.username}`
    : ""

  const topicsPhrase = joinWithOr(topics)

  const professionalMessage = `I'm now taking questions through Drop Me A Question. If you'd like my perspective on ${topicsPhrase}, you can send me a question here: ${pageUrl}`
  const casualMessage = `Have a question for me about ${topicsPhrase}? You can now ask me directly on Drop Me A Question: ${pageUrl}`
  const activeMessage =
    activeTemplate === "professional" ? professionalMessage : casualMessage

  async function copyLink() {
    if (!pageUrl) return
    await navigator.clipboard.writeText(pageUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function copyTemplate() {
    await navigator.clipboard.writeText(activeMessage)
    setCopiedTemplate(true)
    setTimeout(() => setCopiedTemplate(false), 2000)
  }

  function selectTemplate(kind: "professional" | "casual") {
    setActiveTemplate(kind)
    setCopiedTemplate(false)
  }

  const encodedUrl = encodeURIComponent(pageUrl)
  const encodedShareText = encodeURIComponent(
    `Ask me a question on Drop Me A Question: ${pageUrl}`
  )

  // Only platforms with a real web share action get a working link.
  // Instagram, YouTube, TikTok, and "Website" have no such thing -- they're
  // shown as plain icons rather than fake buttons that don't do anything.
  const sharePlatforms: {
    label: string
    href: string | null
    badge?: IconComponent
    icon?: IconComponent
  }[] = [
    {
      label: "LinkedIn",
      badge: LinkedInBadgeIcon,
      href: pageUrl
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
        : null,
    },
    { label: "Instagram", badge: InstagramBadgeIcon, href: null },
    { label: "YouTube", badge: YouTubeBadgeIcon, href: null },
    { label: "TikTok", badge: TikTokBadgeIcon, href: null },
    {
      label: "Facebook",
      badge: FacebookBadgeIcon,
      href: pageUrl
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
        : null,
    },
    {
      label: "X (Twitter)",
      badge: XBadgeIcon,
      href: pageUrl ? `https://x.com/intent/tweet?text=${encodedShareText}` : null,
    },
    {
      label: "Email",
      icon: MailIcon,
      href: pageUrl
        ? `mailto:?subject=${encodeURIComponent("Ask me a question")}&body=${encodedShareText}`
        : null,
    },
    { label: "Website", icon: LinkIcon, href: null },
  ]

  const shareCardParams = new URLSearchParams({ name: profile.fullName || "Your Name" })
  if (headline) shareCardParams.set("headline", headline)
  if (topics.length > 0) shareCardParams.set("topics", topics.join(","))
  if (profile.avatarUrl) shareCardParams.set("avatar", profile.avatarUrl)
  const shareCardUrl = `/api/share-card?${shareCardParams.toString()}`

  return (
    <section>
      <Link
        href="/dashboard"
        className="text-sm text-ink-soft hover:text-ink"
      >
        ← Back to home
      </Link>

      <h1 className="mt-2 font-display text-xl text-ink">
        Get more questions
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Share your Drop Me A Question page wherever your audience already
        follows you.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[65fr_35fr] lg:items-start">
        <div className="min-w-0 space-y-4">
          <div className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-700">
                <LinkIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base text-ink">
                  Your question link
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Share this link with your audience.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="min-w-[160px] flex-1 truncate rounded-sm border border-line bg-line/20 px-3 py-1.5 text-sm text-ink-soft">
                    {pageUrl ? pageUrl.replace(/^https?:\/\//, "") : "..."}
                  </div>
                  <button
                    onClick={copyLink}
                    className="flex-shrink-0 rounded-full border border-postal-red px-3 py-1.5 text-xs font-medium text-postal-red hover:bg-postal-red/10"
                  >
                    {copiedLink ? "Copied!" : "Copy link"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
                <MegaphoneIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base text-ink">
                  Share it with your audience
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Add your link to your social profiles, posts, videos,
                  website, or email signature.
                </p>
                <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
                  {sharePlatforms.map((platform) => {
                    const tile = (
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card">
                        {platform.badge ? (
                          <platform.badge className="h-8 w-8" />
                        ) : platform.icon ? (
                          <platform.icon className="h-4 w-4 text-ink-soft" />
                        ) : null}
                      </span>
                    )
                    return platform.href ? (
                      <a
                        key={platform.label}
                        href={platform.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-col items-center gap-1 text-center hover:opacity-80"
                      >
                        {tile}
                        <span className="text-[11px] text-ink-soft">
                          {platform.label}
                        </span>
                      </a>
                    ) : (
                      <div
                        key={platform.label}
                        className="flex flex-col items-center gap-1 text-center"
                      >
                        {tile}
                        <span className="text-[11px] text-ink-soft">
                          {platform.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
                <DocumentIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base text-ink">
                  Ready to share? Copy a message
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Use one of these templates or edit it to match your style.
                  You can post it on any platform — LinkedIn, Instagram,
                  YouTube, Facebook, X, email, or your website.
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => selectTemplate("professional")}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                      activeTemplate === "professional"
                        ? "bg-postal-red text-white"
                        : "border border-line text-ink-soft hover:border-postal-red hover:text-postal-red"
                    }`}
                  >
                    Professional
                  </button>
                  <button
                    onClick={() => selectTemplate("casual")}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                      activeTemplate === "casual"
                        ? "bg-postal-red text-white"
                        : "border border-line text-ink-soft hover:border-postal-red hover:text-postal-red"
                    }`}
                  >
                    Casual
                  </button>
                </div>

                <div className="mt-2 flex items-end justify-between gap-4 rounded-sm border border-line p-3">
                  <p className="break-words text-xs text-ink-soft">
                    {activeMessage}
                  </p>
                  <button
                    onClick={copyTemplate}
                    className="flex-shrink-0 rounded-full border border-postal-red px-3 py-1.5 text-xs font-medium text-postal-red hover:bg-postal-red/10"
                  >
                    {copiedTemplate ? "Copied!" : "Copy message"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-card p-4">
            <h2 className="font-display text-sm text-ink">Your share card</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              You can use this image when posting on social media, in
              videos, or on your website.
            </p>
            <div className="mt-3 rounded-lg bg-postal-red/5 p-3">
              <img
                src={shareCardUrl}
                alt="Your share card preview"
                className="w-full rounded-lg border border-line"
              />
            </div>
            <a
              href={shareCardUrl}
              download="drop-me-a-question-share-card.png"
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink hover:border-postal-red hover:text-postal-red"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Download image
            </a>
          </div>

          <div className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-postal-red/10 text-postal-red">
                <LightbulbIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-ink">
                  Where to use it
                </h3>
                <p className="mt-1 text-xs text-ink-soft">
                  Share this card in a post, story, video description,
                  email, website, or community. It helps people quickly see
                  your expertise and how to ask you a question.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="mt-6 font-display text-lg text-ink">
        More ways to get questions
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {moreWays.map(
          ({ icon: Icon, iconBg, iconText, title, description, cta, href }) => (
            <div
              key={title}
              className="rounded-lg border border-line bg-card p-4"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg} ${iconText}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="mt-2 text-sm font-medium text-ink">{title}</p>
              <p className="mt-1 text-xs text-ink-soft">{description}</p>
              {cta && href && (
                <Link
                  href={href}
                  className="mt-1.5 inline-block text-xs font-medium text-postal-blue hover:text-ink"
                >
                  {cta} →
                </Link>
              )}
            </div>
          )
        )}
      </div>
    </section>
  )
}
