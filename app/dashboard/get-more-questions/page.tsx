"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useProfileInfo } from "../profile-context"
import {
  ClockIcon,
  DocumentIcon,
  DownloadIcon,
  FacebookIcon,
  ImageIcon,
  InstagramIcon,
  LinkIcon,
  LinkedInIcon,
  MailIcon,
  MegaphoneIcon,
  PersonIcon,
  TagIcon,
  TargetIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/icons"

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
  const [copiedTemplate, setCopiedTemplate] = useState<
    "professional" | "casual" | null
  >(null)

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

  async function copyLink() {
    if (!pageUrl) return
    await navigator.clipboard.writeText(pageUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function copyTemplate(kind: "professional" | "casual") {
    const text = kind === "professional" ? professionalMessage : casualMessage
    await navigator.clipboard.writeText(text)
    setCopiedTemplate(kind)
    setTimeout(() => setCopiedTemplate(null), 2000)
  }

  const encodedUrl = encodeURIComponent(pageUrl)
  const encodedShareText = encodeURIComponent(
    `Ask me a question on Drop Me A Question: ${pageUrl}`
  )

  // Only platforms with a real web share action get a working link.
  // Instagram, YouTube, TikTok, and "Website" have no such thing -- they're
  // shown as plain icons rather than fake buttons that don't do anything.
  const sharePlatforms = [
    {
      label: "LinkedIn",
      icon: LinkedInIcon,
      href: pageUrl
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
        : null,
    },
    { label: "Instagram", icon: InstagramIcon, href: null },
    { label: "YouTube", icon: YouTubeIcon, href: null },
    { label: "TikTok", icon: TikTokIcon, href: null },
    {
      label: "Facebook",
      icon: FacebookIcon,
      href: pageUrl
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
        : null,
    },
    {
      label: "X (Twitter)",
      icon: XIcon,
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
    <section className="max-w-4xl">
      <Link
        href="/dashboard"
        className="text-sm text-ink-soft hover:text-ink"
      >
        ← Back to home
      </Link>

      <h1 className="mt-3 font-display text-2xl text-ink">
        Get more questions
      </h1>
      <p className="mt-1 text-ink-soft">
        Share your Drop Me A Question page wherever your audience already
        follows you.
      </p>
      <p className="text-ink-soft">
        The more people who know about your page, the more questions
        you&apos;ll receive.
      </p>

      <div className="mt-6 rounded-lg border border-line bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-700">
            <LinkIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg text-ink">
              Your question link
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Share this link with your audience.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 truncate rounded-sm border border-line bg-line/20 px-3 py-2 text-sm text-ink-soft">
                {pageUrl ? pageUrl.replace(/^https?:\/\//, "") : "..."}
              </div>
              <button
                onClick={copyLink}
                className="flex-shrink-0 rounded-full border border-postal-red px-4 py-2 text-sm font-medium text-postal-red hover:bg-postal-red/10"
              >
                {copiedLink ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-line bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
            <MegaphoneIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg text-ink">
              Share it with your audience
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Add your link to your social profiles, posts, videos, website,
              or email signature.
            </p>
            <div className="mt-4 grid grid-cols-4 gap-4 sm:grid-cols-8">
              {sharePlatforms.map(({ label, icon: Icon, href }) =>
                href ? (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center gap-1.5 text-center"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-soft hover:border-postal-red hover:text-postal-red">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs text-ink-soft">{label}</span>
                  </a>
                ) : (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1.5 text-center"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-soft">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs text-ink-soft">{label}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-line bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-postal-red/10 text-postal-red">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg text-ink">
              Example share card
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              A ready-made image for posts and stories — the easiest way to
              share on Instagram, where a link alone won&apos;t post.
            </p>
            <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row">
              <img
                src={shareCardUrl}
                alt="Example share card preview"
                className="h-56 w-56 flex-shrink-0 rounded-lg border border-line object-cover"
              />
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-ink-soft">
                  Includes your name, topics and a link back to your page.
                  Download it, then post it directly or drop it into your own
                  design.
                </p>
                <a
                  href={shareCardUrl}
                  download="drop-me-a-question-share-card.png"
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-postal-red px-4 py-2 text-sm font-medium text-postal-red hover:bg-postal-red/10"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Download image
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-line bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
            <DocumentIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg text-ink">
              Ready to share? Copy a message
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Use one of these templates or edit it to match your style. You
              can post it on any platform — LinkedIn, Instagram, YouTube,
              Facebook, X, email, or your website.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-sm border border-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">Professional</p>
                  <button
                    onClick={() => copyTemplate("professional")}
                    className="flex-shrink-0 rounded-full border border-postal-red px-3 py-1 text-xs font-medium text-postal-red hover:bg-postal-red/10"
                  >
                    {copiedTemplate === "professional"
                      ? "Copied!"
                      : "Copy message"}
                  </button>
                </div>
                <p className="mt-2 text-sm text-ink-soft">
                  {professionalMessage}
                </p>
              </div>

              <div className="rounded-sm border border-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">Casual</p>
                  <button
                    onClick={() => copyTemplate("casual")}
                    className="flex-shrink-0 rounded-full border border-postal-red px-3 py-1 text-xs font-medium text-postal-red hover:bg-postal-red/10"
                  >
                    {copiedTemplate === "casual" ? "Copied!" : "Copy message"}
                  </button>
                </div>
                <p className="mt-2 text-sm text-ink-soft">{casualMessage}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="mt-8 font-display text-xl text-ink">
        More ways to get questions
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {moreWays.map(
          ({ icon: Icon, iconBg, iconText, title, description, cta, href }) => (
            <div
              key={title}
              className="rounded-lg border border-line bg-white p-5"
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full ${iconBg} ${iconText}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-3 font-medium text-ink">{title}</p>
              <p className="mt-1 text-sm text-ink-soft">{description}</p>
              {cta && href && (
                <Link
                  href={href}
                  className="mt-2 inline-block text-sm font-medium text-postal-blue hover:text-ink"
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
