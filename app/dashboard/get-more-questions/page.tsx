"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useProfileInfo } from "../profile-context"
import {
  CheckIcon,
  ClockIcon,
  DocumentIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FacebookBadgeIcon,
  ImageIcon,
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
type CardStyle = "profile" | "topic"
type MessageKind = "professional" | "casual" | "short"

function joinWithOr(items: string[]): string {
  if (items.length === 0) return "my area of expertise"
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} or ${items[1]}`
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "my area of expertise"
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

const cardStyles: {
  value: CardStyle
  title: string
  description: string
  icon: IconComponent
}[] = [
  {
    value: "profile",
    title: "Profile card",
    description: "Your photo, role and topics",
    icon: PersonIcon,
  },
  {
    value: "topic",
    title: "Topic card",
    description: "Focus on a specific topic",
    icon: TagIcon,
  },
]

const whereToUse: { label: string; use: string; badge?: IconComponent; icon?: IconComponent }[] = [
  { label: "LinkedIn", use: "Post or add to your profile.", badge: LinkedInBadgeIcon },
  { label: "Instagram", use: "Share in a post or story.", badge: InstagramBadgeIcon },
  { label: "YouTube", use: "Add to your video description.", badge: YouTubeBadgeIcon },
  { label: "TikTok", use: "Use in a post or video.", badge: TikTokBadgeIcon },
  { label: "Facebook", use: "Share in a post or group.", badge: FacebookBadgeIcon },
  { label: "Email", use: "Include in your email signature.", icon: MailIcon },
  { label: "Website", use: "Add to your website or blog.", icon: LinkIcon },
]

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
  const [topicsLoaded, setTopicsLoaded] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<MessageKind>("professional")
  const [copiedTemplate, setCopiedTemplate] = useState(false)
  const [notice, setNotice] = useState("")

  const [cardStyle, setCardStyle] = useState<CardStyle>("profile")
  // "" means "show my main profile" (no topic highlighted).
  const [highlight, setHighlight] = useState("")
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const [cardReloadKey, setCardReloadKey] = useState(0)
  // Which request the preview last finished (and how it ended). Whatever
  // doesn't match the current choices is still loading.
  const [cardDone, setCardDone] = useState<{ key: string; error: string } | null>(null)
  const cardUrlRef = useRef<string | null>(null)

  const cardKey = `${cardStyle}|${highlight}|${cardReloadKey}`
  const cardLoading = cardDone?.key !== cardKey
  const cardError = cardDone?.key === cardKey ? cardDone.error : ""

  useEffect(() => {
    async function loadTopics() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return

      const { data } = await supabase
        .from("expert_topics")
        .select("name")
        .eq("expert_id", sessionData.session.user.id)
        .order("sort_order", { ascending: true })

      setTopics((data ?? []).map((t) => t.name))
      setTopicsLoaded(true)
    }
    loadTopics()
  }, [])

  // The card is generated on the server for the signed-in expert. An <img>
  // can't send the login token, so it's fetched here and shown from a blob.
  useEffect(() => {
    if (!topicsLoaded) return

    const controller = new AbortController()
    const key = `${cardStyle}|${highlight}|${cardReloadKey}`

    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) throw new Error("Please log in again.")

        const params = new URLSearchParams({ style: cardStyle })
        if (highlight) params.set("topic", highlight)

        const res = await fetch(`/api/share-card?${params.toString()}`, {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
          signal: controller.signal,
        })

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(
            typeof body?.error === "string"
              ? body.error
              : "Could not create your card right now."
          )
        }

        const nextUrl = URL.createObjectURL(await res.blob())
        if (cardUrlRef.current) URL.revokeObjectURL(cardUrlRef.current)
        cardUrlRef.current = nextUrl
        setCardUrl(nextUrl)
        setCardDone({ key, error: "" })
      } catch (err) {
        if (controller.signal.aborted) return
        setCardDone({
          key,
          error:
            err instanceof Error && err.message
              ? err.message
              : "Could not create your card right now.",
        })
      }
    })()

    return () => controller.abort()
  }, [topicsLoaded, cardStyle, highlight, cardReloadKey])

  useEffect(() => {
    return () => {
      if (cardUrlRef.current) URL.revokeObjectURL(cardUrlRef.current)
    }
  }, [])

  // The share notice clears itself.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(""), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  function chooseCardStyle(next: CardStyle) {
    setCardStyle(next)
    // A topic card needs a topic; default to the first one.
    if (next === "topic" && !highlight && topics.length > 0) {
      setHighlight(topics[0])
    }
  }

  const showNotice = setNotice

  const pageUrl = profile.username
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${profile.username}`
    : ""

  // When a topic is highlighted the messages promote that topic only.
  const messageTopics = highlight ? [highlight] : topics
  const topicsPhrase = joinWithOr(messageTopics)

  const messages: Record<MessageKind, string> = {
    professional: `I'm now taking questions through Drop Me A Question. If you'd like my perspective on ${topicsPhrase}, you can send me a question here: ${pageUrl}`,
    casual: `Have a question for me about ${topicsPhrase}? You can now ask me directly on Drop Me A Question: ${pageUrl}`,
    short: `I'm taking questions about ${joinWithAnd(messageTopics.slice(0, 3))}. Ask me here → ${pageUrl}`,
  }
  const activeMessage = messages[activeTemplate]

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  async function copyLink() {
    if (!pageUrl) return
    if (await copyText(pageUrl)) {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  async function copyTemplate() {
    if (await copyText(activeMessage)) {
      setCopiedTemplate(true)
      setTimeout(() => setCopiedTemplate(false), 2000)
    }
  }

  function selectTemplate(kind: MessageKind) {
    setActiveTemplate(kind)
    setCopiedTemplate(false)
  }

  type SharePlatform = {
    label: string
    badge?: IconComponent
    icon?: IconComponent
    // Opens an external page (shows the ↗ marker).
    external: boolean
    href?: string
    // Run on click, before any navigation.
    onClick?: () => void
  }

  const encodedUrl = encodeURIComponent(pageUrl)

  // LinkedIn and Facebook only accept a link now, not pre-filled text, so we
  // copy the message for the person to paste. Instagram, TikTok, YouTube and
  // websites have no share link at all: copy the link and say where to put it.
  const sharePlatforms: SharePlatform[] = [
    {
      label: "LinkedIn",
      badge: LinkedInBadgeIcon,
      external: true,
      href: pageUrl
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
        : undefined,
      onClick: async () => {
        if (await copyText(activeMessage)) {
          showNotice("Message copied. Paste it into your LinkedIn post.")
        }
      },
    },
    {
      label: "Instagram",
      badge: InstagramBadgeIcon,
      external: false,
      onClick: async () => {
        await copyText(pageUrl)
        showNotice(
          "Link copied. Add it to your Instagram bio, and post your card as an image or story."
        )
      },
    },
    {
      label: "YouTube",
      badge: YouTubeBadgeIcon,
      external: false,
      onClick: async () => {
        await copyText(pageUrl)
        showNotice("Link copied. Paste it into your video description or channel links.")
      },
    },
    {
      label: "TikTok",
      badge: TikTokBadgeIcon,
      external: false,
      onClick: async () => {
        await copyText(pageUrl)
        showNotice("Link copied. Add it to your TikTok bio or a video caption.")
      },
    },
    {
      label: "Facebook",
      badge: FacebookBadgeIcon,
      external: true,
      href: pageUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` : undefined,
      onClick: async () => {
        if (await copyText(activeMessage)) {
          showNotice("Message copied. Paste it into your Facebook post.")
        }
      },
    },
    {
      label: "X (Twitter)",
      badge: XBadgeIcon,
      external: true,
      href: pageUrl
        ? `https://x.com/intent/tweet?text=${encodeURIComponent(messages.short)}`
        : undefined,
    },
    {
      label: "Email",
      icon: MailIcon,
      external: false,
      href: pageUrl
        ? `mailto:?subject=${encodeURIComponent("Drop me a question")}&body=${encodeURIComponent(activeMessage)}`
        : undefined,
    },
    {
      label: "Website",
      icon: LinkIcon,
      external: false,
      onClick: async () => {
        await copyText(pageUrl)
        showNotice("Link copied. Add it to your site's menu, footer or contact page.")
      },
    },
  ]

  const downloadName = `drop-me-a-question-${cardStyle === "topic" ? "topic" : "profile"}-card.png`

  const previewBlock = (
    <>
      <div className="relative overflow-hidden rounded-lg border border-line bg-postal-red/5">
        {cardUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cardUrl}
            alt="Preview of your share card"
            className={`aspect-[4/5] w-full object-contain transition-opacity ${
              cardLoading ? "opacity-40" : "opacity-100"
            }`}
          />
        ) : (
          <div className="aspect-[4/5] w-full" />
        )}
        {cardLoading && (
          <p className="absolute inset-0 flex items-center justify-center text-xs font-medium text-ink-soft">
            Creating your card...
          </p>
        )}
      </div>
      {cardError && (
        <p className="mt-2 text-xs text-postal-red">
          {cardError}{" "}
          <button
            type="button"
            onClick={() => setCardReloadKey((k) => k + 1)}
            className="font-medium underline underline-offset-2"
          >
            Try again
          </button>
        </p>
      )}
      <a
        href={cardUrl ?? undefined}
        download={downloadName}
        aria-disabled={!cardUrl || cardLoading}
        className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-medium text-ink hover:border-postal-red hover:text-postal-red ${
          !cardUrl || cardLoading ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <DownloadIcon className="h-3.5 w-3.5" />
        Download image
      </a>
    </>
  )

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

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-700">
                <LinkIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base text-ink">
                  Your Drop Me A Question link
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Share this link anywhere people already follow you.
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
                  Share your page
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Click an icon to share your page. Where a platform can&apos;t
                  be pre-filled, we copy your message so you can paste it.
                </p>
                <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
                  {sharePlatforms.map((platform) => {
                    const content = (
                      <>
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card">
                          {platform.badge ? (
                            <platform.badge className="h-8 w-8" />
                          ) : platform.icon ? (
                            <platform.icon className="h-4 w-4 text-ink-soft" />
                          ) : null}
                        </span>
                        <span className="text-[11px] text-ink-soft">
                          {platform.label}
                        </span>
                        {platform.external && (
                          <ExternalLinkIcon className="h-2.5 w-2.5 text-ink-soft/70" />
                        )}
                      </>
                    )
                    const className =
                      "flex flex-col items-center gap-1 text-center hover:opacity-80"

                    return platform.href ? (
                      <a
                        key={platform.label}
                        href={platform.href}
                        target={platform.external ? "_blank" : undefined}
                        rel={platform.external ? "noreferrer" : undefined}
                        onClick={platform.onClick}
                        className={className}
                      >
                        {content}
                      </a>
                    ) : (
                      <button
                        key={platform.label}
                        type="button"
                        onClick={platform.onClick}
                        className={className}
                      >
                        {content}
                      </button>
                    )
                  })}
                </div>
                <p
                  role="status"
                  aria-live="polite"
                  className={`mt-3 rounded-sm bg-green-500/10 px-3 py-2 text-xs text-green-800 ${
                    notice ? "" : "hidden"
                  }`}
                >
                  {notice}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-postal-red/10 text-postal-red">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base text-ink">
                  Create a share card
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Choose a style, or highlight a topic you want to promote, to
                  create a shareable image.
                </p>

                <p className="mt-3 text-xs font-medium text-ink">
                  1. Choose a card style
                </p>
                <div
                  role="radiogroup"
                  aria-label="Card style"
                  className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {cardStyles.map(({ value, title, description, icon: Icon }) => {
                    const selected = cardStyle === value
                    const unavailable = value === "topic" && topics.length === 0
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={unavailable}
                        onClick={() => chooseCardStyle(value)}
                        className={`relative flex flex-col items-center rounded-lg border p-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected
                            ? "border-postal-red bg-postal-red/5"
                            : "border-line bg-card hover:border-postal-red/50"
                        }`}
                      >
                        {selected && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-postal-red text-white">
                            <CheckIcon className="h-3 w-3" />
                          </span>
                        )}
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lavender text-ink">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="mt-2 text-sm font-medium text-ink">
                          {title}
                        </span>
                        <span className="mt-0.5 text-xs text-ink-soft">
                          {unavailable ? "Add topics to your profile first" : description}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <label
                  htmlFor="highlight-topic"
                  className="mt-4 block text-xs font-medium text-ink"
                >
                  {cardStyle === "topic"
                    ? "2. Choose a topic"
                    : "2. (Optional) Highlight a topic"}
                </label>
                <select
                  id="highlight-topic"
                  value={highlight}
                  onChange={(e) => setHighlight(e.target.value)}
                  className="mt-2 w-full rounded-sm border border-line bg-card px-3 py-2 text-sm text-ink"
                >
                  {cardStyle === "profile" && (
                    <option value="">Show my main profile</option>
                  )}
                  {topics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
                {topics.length === 0 && topicsLoaded && (
                  <p className="mt-1.5 text-xs text-ink-soft">
                    Add &quot;Ask me about&quot; topics in{" "}
                    <Link
                      href="/dashboard/profile"
                      className="font-medium text-postal-blue underline underline-offset-2"
                    >
                      your profile
                    </Link>{" "}
                    to highlight them here.
                  </p>
                )}

                <div className="mt-4 xl:hidden">{previewBlock}</div>
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
                  Ready-to-share message
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Use one of these templates or edit it to match your style.
                  You can post it on any platform — LinkedIn, Instagram,
                  YouTube, Facebook, X, email, or your website.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["professional", "Professional"],
                      ["casual", "Casual"],
                      ["short", "Short"],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      onClick={() => selectTemplate(kind)}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                        activeTemplate === kind
                          ? "bg-postal-red text-white"
                          : "border border-line text-ink-soft hover:border-postal-red hover:text-postal-red"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
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

        <div className="hidden flex-col gap-4 xl:flex">
          <div className="sticky top-6 flex flex-col gap-4">
            <div className="rounded-lg border border-line bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
                  <EyeIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base text-ink">
                    Preview: Your share card
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    This is how your card will look when shared.
                  </p>
                </div>
              </div>
              <div className="mt-3">{previewBlock}</div>
            </div>

            <div className="rounded-lg border border-line bg-lavender/30 p-4">
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
                  <ul className="mt-3 space-y-2">
                    {whereToUse.map(({ label, use, badge: Badge, icon: Icon }) => (
                      <li key={label} className="flex items-center gap-2 text-xs">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                          {Badge ? (
                            <Badge className="h-5 w-5" />
                          ) : Icon ? (
                            <Icon className="h-4 w-4 text-ink-soft" />
                          ) : null}
                        </span>
                        <span className="w-16 flex-shrink-0 font-medium text-ink">
                          {label}
                        </span>
                        <span className="text-ink-soft">{use}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
