"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import QRCode from "qrcode"
import { supabase } from "@/lib/supabase"
import { formatResponseWindow } from "@/lib/format"
import { useProfileInfo } from "../profile-context"
import { useActiveStatus } from "../active-status-context"
import {
  ChatIcon,
  ClockIcon,
  LightbulbIcon,
  LinkIcon,
  MailIcon,
  PauseIcon,
  QrCodeIcon,
} from "@/components/icons"

const PAUSE_MESSAGE_MAX = 200

// Rotating background tints for topic pills -- matches the public profile
// page and the other dashboard live previews.
const TOPIC_STYLES = ["bg-lavender/60", "bg-postal-blue/10", "bg-line/50"]

const tips = [
  "Share your page link on LinkedIn, X (Twitter) or email.",
  "Add your DMQ link to your email signature.",
  "Mention specific topics you're happy to answer in your profile.",
]

export default function SettingsPage() {
  const { profile } = useProfileInfo()
  const { isActive, loading: activeStatusLoading, toggling, toggleActive } = useActiveStatus()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [username, setUsername] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [generatingQr, setGeneratingQr] = useState(false)

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pauseMessage, setPauseMessage] = useState("")

  const [headline, setHeadline] = useState("")
  const [topics, setTopics] = useState<string[]>([])
  const [priceCents, setPriceCents] = useState(0)
  const [responseWindowHours, setResponseWindowHours] = useState(24)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError("")
    setSaved(false)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data: profileData } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single()

    if (profileData) setUsername(profileData.username)

    const { data: expert } = await supabase
      .from("experts")
      .select(
        "pause_message, email_notifications, headline, price_cents, response_window_hours"
      )
      .eq("id", userId)
      .single()

    if (expert) {
      setPauseMessage(expert.pause_message ?? "")
      setEmailNotifications(expert.email_notifications ?? true)
      setHeadline(expert.headline ?? "")
      setPriceCents(expert.price_cents ?? 0)
      setResponseWindowHours(expert.response_window_hours ?? 24)
    }

    const { data: topicsData } = await supabase
      .from("expert_topics")
      .select("name")
      .eq("expert_id", userId)
      .order("sort_order", { ascending: true })

    setTopics(topicsData?.map((t) => t.name) ?? [])
    setLoading(false)
  }

  async function copyLink() {
    if (!username) return
    await navigator.clipboard.writeText(`${window.location.origin}/${username}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function toggleQrCode() {
    if (qrCodeUrl) {
      setQrCodeUrl(null)
      return
    }
    if (!username) return

    setGeneratingQr(true)
    const dataUrl = await QRCode.toDataURL(`${window.location.origin}/${username}`, {
      width: 320,
      margin: 2,
      color: { dark: "#17243a", light: "#f8f6f1" },
    })
    setQrCodeUrl(dataUrl)
    setGeneratingQr(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError("")

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { error: updateError } = await supabase
      .from("experts")
      .update({
        pause_message: pauseMessage.trim() || null,
        email_notifications: emailNotifications,
      })
      .eq("id", userId)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  const price = (priceCents / 100).toFixed(2)

  return (
    <section>
      <h1 className="font-display text-xl text-ink">Page settings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Manage your public page link and decide when you want to accept
        questions.
      </p>

      <form
        onSubmit={handleSave}
        className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[65fr_35fr]"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-lg border border-line bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
                <LinkIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-ink">
                  Your page link
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  This is the link people can use to ask you a question.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="min-w-[160px] flex-1 truncate rounded-sm border border-line bg-line/20 px-3 py-2 text-sm text-ink-soft">
                    dropmeaquestion.com/{username}
                  </div>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="flex-shrink-0 rounded-full border border-line px-3 py-2 text-xs font-medium text-ink hover:bg-line/40"
                  >
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleQrCode}
                    disabled={generatingQr}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-medium text-ink hover:bg-line/40 disabled:opacity-50"
                  >
                    <QrCodeIcon className="h-3.5 w-3.5" />
                    {generatingQr
                      ? "Generating..."
                      : qrCodeUrl
                        ? "Hide QR code"
                        : "Get QR code"}
                  </button>
                </div>

                {qrCodeUrl && (
                  <div className="mt-3 inline-block rounded-sm border border-line p-4 text-center">
                    <img
                      src={qrCodeUrl}
                      alt="QR code for your page link"
                      className="h-40 w-40"
                    />
                    <a
                      href={qrCodeUrl}
                      download={`${username}-qr-code.png`}
                      className="mt-2 block text-xs text-postal-blue underline decoration-line underline-offset-4 hover:text-ink"
                    >
                      Download
                    </a>
                  </div>
                )}

                <div className="mt-3 flex items-start gap-3 rounded-lg bg-green-500/10 p-3">
                  <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-green-600" />
                  <p className="text-xs text-ink">
                    <span className="font-semibold text-green-700">
                      Your page is live and ready to share!
                    </span>{" "}
                    Share this link on LinkedIn, X (Twitter), email, or
                    anywhere your audience follows you.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
                  <ClockIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-ink">
                    Accepting questions
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Control whether visitors can currently send you
                    questions.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex flex-shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={toggleActive}
                  disabled={activeStatusLoading || toggling}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-green-500 peer-disabled:opacity-50" />
                <div className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
              </label>
            </div>

            <div
              className={`mt-3 flex items-start gap-3 rounded-lg p-3 ${
                isActive ? "bg-green-500/10" : "bg-line/30"
              }`}
            >
              <span
                className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${
                  isActive ? "bg-green-600" : "bg-ink-soft/50"
                }`}
              />
              <p className="text-xs text-ink">
                <span
                  className={`font-semibold ${
                    isActive ? "text-green-700" : "text-ink"
                  }`}
                >
                  {isActive ? "You're accepting questions" : "You're paused"}
                </span>{" "}
                {isActive
                  ? "Visitors can drop you a question right now."
                  : "Visitors will see your pause message instead of the question form."}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
                <MailIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-ink">
                  Notifications
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Get notified when you receive a new question.
                </p>

                <label className="mt-3 flex items-start gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-sm border-line text-postal-red focus:ring-postal-red"
                  />
                  <span>
                    <span className="font-medium text-ink">
                      Email notifications
                    </span>
                    <br />
                    <span className="text-xs text-ink-soft">
                      Send me an email when I receive a new question.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-postal-red/10 text-postal-red">
                <PauseIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-ink">
                  Pause message{" "}
                  <span className="font-normal text-ink-soft">
                    (optional)
                  </span>
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  This message is shown when you&apos;re not accepting
                  questions.
                </p>
                <textarea
                  rows={3}
                  maxLength={PAUSE_MESSAGE_MAX}
                  value={pauseMessage}
                  onChange={(e) => setPauseMessage(e.target.value)}
                  placeholder="I'm currently not accepting new questions. Please check back soon!"
                  className="mt-2 w-full rounded-sm border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60"
                />
                <p className="mt-1 text-right text-xs text-ink-soft">
                  {pauseMessage.length}/{PAUSE_MESSAGE_MAX}
                </p>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-postal-red">{error}</p>}
          {saved && <p className="text-sm text-postal-blue">Saved.</p>}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-postal-red px-6 py-2.5 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={load}
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-line bg-card p-4">
            <h2 className="text-sm font-semibold text-ink">
              Preview of your page
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              This is how visitors will see your page.
            </p>

            <div className="mt-3 overflow-hidden rounded-lg border border-line">
              <div className="h-16 bg-gradient-to-r from-postal-red/20 via-lavender to-postal-blue/10" />
              <div className="bg-card px-4 pb-5 text-center">
                <div className="mx-auto -mt-8 flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-lavender/40">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.fullName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-medium text-ink-soft">
                      {profile.fullName.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-display text-base font-semibold text-ink">
                  {profile.fullName || "Your Name"}
                </p>
                {headline && <p className="text-sm text-ink-soft">{headline}</p>}

                {topics.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                    {topics.map((topic, i) => (
                      <span
                        key={topic}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium text-ink ${TOPIC_STYLES[i % TOPIC_STYLES.length]}`}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 border-t border-line pt-3">
                  <p className="font-display text-2xl font-semibold text-ink">
                    ${price}
                  </p>
                  <p className="text-xs text-ink-soft">per question</p>
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Responds within{" "}
                    {formatResponseWindow(responseWindowHours)}
                  </p>
                </div>

                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-postal-red px-4 py-2 text-xs font-medium text-white">
                  <ChatIcon className="h-3.5 w-3.5" />
                  Drop me a question →
                </div>

                <div
                  className={`mt-3 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                    isActive
                      ? "bg-green-500/10 text-green-700"
                      : "bg-line/40 text-ink-soft"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      isActive ? "bg-green-600" : "bg-ink-soft/50"
                    }`}
                  />
                  {isActive
                    ? "Currently accepting questions"
                    : "Not currently accepting questions"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-lavender/30 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
                <LightbulbIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-ink">
                  Tips to get more questions
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {tips.map((tip) => (
                    <li
                      key={tip}
                      className="list-disc text-xs text-ink-soft marker:text-ink-soft/60"
                      style={{ marginLeft: "1rem" }}
                    >
                      {tip}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard/get-more-questions"
                  className="mt-2 inline-block text-xs font-medium text-postal-blue hover:text-ink"
                >
                  Learn more →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>
    </section>
  )
}
