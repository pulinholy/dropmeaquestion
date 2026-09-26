"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useProfileInfo } from "../profile-context"
import {
  ChatIcon,
  ClockIcon,
  DollarSignIcon,
  PersonIcon,
} from "@/components/icons"

export default function GetMoreQuestionsPage() {
  const { profile } = useProfileInfo()
  const [topics, setTopics] = useState<string[]>([])
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedPost, setCopiedPost] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    loadTopics()
    setCanShare(typeof navigator !== "undefined" && !!navigator.share)
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
  }

  const pageUrl = profile.username
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${profile.username}`
    : ""

  const topicsPhrase =
    topics.length > 0 ? topics.join(", ") : "my area of expertise"

  const linkedInPost = `I've opened a page on Drop Me A Question where you can send me questions about ${topicsPhrase}. If there's something I can help with, you can ask me here: ${pageUrl}`

  async function copyLink() {
    if (!pageUrl) return
    await navigator.clipboard.writeText(pageUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function copyPost() {
    await navigator.clipboard.writeText(linkedInPost)
    setCopiedPost(true)
    setTimeout(() => setCopiedPost(false), 2000)
  }

  async function shareLink() {
    if (!pageUrl) return
    try {
      await navigator.share({
        title: "Ask me a question",
        text: "Ask me a question on Drop Me A Question:",
        url: pageUrl,
      })
    } catch {
      // User canceled the share sheet — nothing to do.
    }
  }

  return (
    <section className="max-w-2xl">
      <Link
        href="/dashboard"
        className="text-sm text-ink-soft hover:text-ink"
      >
        ← Back to Home
      </Link>

      <h1 className="mt-3 font-display text-2xl text-ink">
        Get more questions
      </h1>
      <p className="mt-1 text-ink-soft">
        The easiest way to get started is to share your page with people
        who already know your expertise.
      </p>

      <div className="mt-6 rounded-lg border border-line bg-white p-6">
        <h2 className="font-display text-lg text-ink">1. Share your page</h2>
        <p className="mt-1 text-sm text-ink-soft">Your personal question link</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="truncate rounded-sm border border-line bg-line/20 px-3 py-2 text-sm text-ink-soft">
            {pageUrl ? pageUrl.replace(/^https?:\/\//, "") : "..."}
          </div>
          <button
            onClick={copyLink}
            className="flex-shrink-0 rounded-sm border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-line/40"
          >
            {copiedLink ? "Copied!" : "Copy link"}
          </button>
          {canShare && (
            <button
              onClick={shareLink}
              className="flex-shrink-0 rounded-full bg-postal-red px-4 py-2 text-sm font-medium text-paper hover:bg-ink"
            >
              Share
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <p className="text-sm font-medium text-ink">Share on LinkedIn</p>
          <p className="mt-1 text-sm text-ink-soft">
            Let your network know they can now ask you questions directly.
          </p>
          <div className="mt-2 rounded-sm border border-line bg-line/20 p-3 text-sm text-ink-soft">
            {linkedInPost}
          </div>
          <button
            onClick={copyPost}
            className="mt-2 rounded-sm border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-line/40"
          >
            {copiedPost ? "Copied!" : "Copy LinkedIn post"}
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
              <ChatIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-ink">
                Make your expertise specific
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Instead of broad topics like{" "}
                <span className="italic">
                  Technology · Business · Careers
                </span>
                , try something specific like{" "}
                <span className="italic">
                  Salesforce · Career transitions · Technical interviews
                </span>
                .
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/profile"
            className="flex-shrink-0 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink hover:bg-line/40"
          >
            Edit my topics
          </Link>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-700">
              <PersonIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-ink">
                Make your profile trustworthy
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                A clear photo, professional title, and short bio help people
                understand why you&apos;re the right person to ask.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/profile"
            className="flex-shrink-0 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink hover:bg-line/40"
          >
            Edit profile
          </Link>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-postal-red/10 text-postal-red">
              <DollarSignIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-ink">
                Set a price that fits your expertise
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Choose a price you&apos;re comfortable with. You can change
                it anytime.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/pricing"
            className="flex-shrink-0 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink hover:bg-line/40"
          >
            Review pricing
          </Link>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-line bg-white p-5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
            <ClockIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium text-ink">Answer consistently</p>
            <p className="mt-1 text-sm text-ink-soft">
              Respond within the time you&apos;ve promised. A good
              experience makes people more likely to ask you again.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
