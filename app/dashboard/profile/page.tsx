"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useProfileInfo } from "../profile-context"
import TopicInput from "@/components/TopicInput"
import { slugify } from "@/lib/slugify"
import { CheckIcon, ChatIcon, EyeIcon } from "@/components/icons"

const HEADLINE_MAX = 100
const BIO_MAX = 500
const MIN_BIO_FOR_AI = 30
const MAX_AI_IMPROVEMENTS = 3

// Rotating background tints for topic pills -- matches the public profile
// page, since real topics are free-text with no icon to key off of.
const TOPIC_STYLES = ["bg-lavender/60", "bg-postal-blue/10", "bg-line/50"]

const profileTips = [
  "Use a clear, friendly photo",
  "Write a short, specific headline",
  "Mention your experience and how you can help",
  "Add relevant topics (up to 5)",
]

export default function ProfilePage() {
  const { refreshProfile } = useProfileInfo()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [headline, setHeadline] = useState("")
  const [bio, setBio] = useState("")
  const [topics, setTopics] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState("")
  const [bioBeforeAi, setBioBeforeAi] = useState<string | null>(null)
  const [improvingBio, setImprovingBio] = useState(false)
  const [aiError, setAiError] = useState("")
  const [aiImproveCount, setAiImproveCount] = useState(0)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError("")
    setSaved(false)
    setBioBeforeAi(null)
    setAiError("")

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userId)
      .single()

    const { data: expert } = await supabase
      .from("experts")
      .select("headline, bio")
      .eq("id", userId)
      .single()

    if (profile) {
      const [first, ...rest] = (profile.full_name ?? "").split(" ")
      setFirstName(first ?? "")
      setLastName(rest.join(" "))
      setAvatarUrl(profile.avatar_url)
    }
    if (expert) {
      setHeadline(expert.headline ?? "")
      setBio(expert.bio ?? "")
    }

    const { data: topicsData } = await supabase
      .from("expert_topics")
      .select("name")
      .eq("expert_id", userId)
      .order("sort_order", { ascending: true })

    setTopics(topicsData?.map((t) => t.name) ?? [])
    setLoading(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarError("")
    setUploadingAvatar(true)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return
    const userId = sessionData.session.user.id

    const ext = file.name.split(".").pop()
    const path = `${userId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setAvatarError(uploadError.message)
      setUploadingAvatar(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path)

    // Cache-bust so a re-upload to the same path shows immediately
    const freshUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: freshUrl })
      .eq("id", userId)

    if (updateError) {
      setAvatarError(updateError.message)
    } else {
      setAvatarUrl(freshUrl)
      refreshProfile()
    }
    setUploadingAvatar(false)
  }

  async function handleRemoveAvatar() {
    setAvatarError("")
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return
    const userId = sessionData.session.user.id

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId)

    if (updateError) {
      setAvatarError(updateError.message)
    } else {
      setAvatarUrl(null)
      refreshProfile()
    }
  }

  async function handleImproveBio() {
    setImprovingBio(true)
    setAiError("")
    const previousBio = bio

    try {
      const res = await fetch("/api/improve-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
      })
      const data = await res.json()

      if (data.error) {
        setAiError(data.error)
      } else {
        setBio(data.improvedBio)
        setBioBeforeAi(previousBio)
        setAiImproveCount((c) => c + 1)
      }
    } catch {
      setAiError("Could not improve this bio right now.")
    }

    setImprovingBio(false)
  }

  function handleUndoImprove() {
    if (bioBeforeAi !== null) {
      setBio(bioBeforeAi)
      setBioBeforeAi(null)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError("")

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: `${firstName.trim()} ${lastName.trim()}`.trim() })
      .eq("id", userId)

    const { error: expertError } = await supabase
      .from("experts")
      .update({ headline, bio })
      .eq("id", userId)

    // Replace the topic list wholesale rather than diffing -- simplest
    // correct approach for a max-5-item tag list.
    const { error: deleteTopicsError } = await supabase
      .from("expert_topics")
      .delete()
      .eq("expert_id", userId)

    let topicsError = deleteTopicsError
    if (!topicsError && topics.length > 0) {
      const { error } = await supabase.from("expert_topics").insert(
        topics.map((name, index) => ({
          expert_id: userId,
          name,
          slug: slugify(name),
          sort_order: index,
        }))
      )
      topicsError = error
    }

    if (profileError || expertError || topicsError) {
      setError(
        (profileError ?? expertError ?? topicsError)?.message ?? "Something went wrong."
      )
    } else {
      setSaved(true)
      refreshProfile()
    }
    setSaving(false)
  }

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  const fullName = `${firstName} ${lastName}`.trim() || "Your Name"

  return (
    <section>
      <p className="text-sm text-ink-soft">Profile</p>
      <h1 className="mt-1 font-display text-xl text-ink">Your profile</h1>
      <p className="mt-1 text-sm text-ink-soft">
        This information will be shown on your public page so people know
        who you are and what they can ask you.
      </p>

      <form
        onSubmit={handleSave}
        className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[65fr_35fr]"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-lg border border-line bg-card p-5">
            <h2 className="text-sm font-semibold text-ink">Profile picture</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              A clear, friendly photo helps people recognize you.
            </p>
            <div className="mt-3 flex items-center gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Your profile picture"
                  className="h-20 w-20 flex-shrink-0 rounded-full border border-line object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border border-line bg-line/40 text-2xl font-medium text-ink-soft">
                  {firstName.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-line/40">
                  {uploadingAvatar ? "Uploading..." : "Upload photo"}
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleAvatarChange}
                    disabled={uploadingAvatar}
                    className="hidden"
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-line/40"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            {avatarError && (
              <p className="mt-2 text-sm text-postal-red">{avatarError}</p>
            )}
            <p className="mt-3 text-xs text-ink-soft">
              Recommended: square image, at least 400 × 400 px.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-card p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-ink">
                  First name <span className="text-postal-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-2 w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink">
                  Last name <span className="text-ink-soft">(optional)</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-2 w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <label className="block text-sm font-semibold text-ink">
                Headline <span className="text-postal-red">*</span>
              </label>
              <span className="flex-shrink-0 text-xs text-ink-soft">
                {headline.length}/{HEADLINE_MAX}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">
              Show people your role or expertise in a few words.
            </p>
            <input
              type="text"
              required
              maxLength={HEADLINE_MAX}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="mt-2 w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
            />
            <p className="mt-1.5 text-xs text-ink-soft">
              Examples: &quot;Salesforce Developer&quot;, &quot;Marketing
              Strategist&quot;, &quot;Career Coach&quot;
            </p>
          </div>

          <div className="rounded-lg border border-line bg-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <label className="block text-sm font-semibold text-ink">
                Short bio <span className="text-postal-red">*</span>
              </label>
              <span className="flex-shrink-0 text-xs text-ink-soft">
                {bio.length}/{BIO_MAX}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">
              Tell people a bit about yourself and how you can help.
            </p>
            <textarea
              required
              rows={4}
              maxLength={BIO_MAX}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-2 w-full rounded-sm border border-line px-3 py-2 text-sm text-ink"
            />
            <div className="mt-1.5">
              {bioBeforeAi !== null ? (
                <p className="flex items-center gap-2 text-xs">
                  <span className="text-green-700">✓ Improved with AI</span>
                  <button
                    type="button"
                    onClick={handleUndoImprove}
                    className="font-medium text-postal-red hover:text-ink"
                  >
                    Undo
                  </button>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleImproveBio}
                  disabled={
                    bio.trim().length < MIN_BIO_FOR_AI ||
                    improvingBio ||
                    aiImproveCount >= MAX_AI_IMPROVEMENTS
                  }
                  className="text-xs font-medium text-postal-red hover:text-ink disabled:cursor-not-allowed disabled:text-ink-soft/50 disabled:hover:text-ink-soft/50"
                >
                  {improvingBio
                    ? "✨ Improving..."
                    : aiImproveCount >= MAX_AI_IMPROVEMENTS
                      ? "No more AI improvements left"
                      : "✨ Improve with AI"}
                </button>
              )}
            </div>
            {aiError && (
              <p className="mt-1 text-xs text-postal-red">{aiError}</p>
            )}
          </div>

          <div className="rounded-lg border border-line bg-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <label className="block text-sm font-semibold text-ink">
                What can people ask you about?{" "}
                <span className="text-postal-red">*</span>
              </label>
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">
              Add up to 5 topics that describe your expertise.
            </p>
            <div className="mt-2">
              <TopicInput topics={topics} onChange={setTopics} />
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
              This is how your profile information will appear to others.
            </p>

            <div className="mt-3 overflow-hidden rounded-lg border border-line">
              <div className="h-16 bg-gradient-to-r from-postal-red/20 via-lavender to-postal-blue/10" />
              <div className="bg-card px-4 pb-5 text-center">
                <div className="mx-auto -mt-8 flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-lavender/40">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={fullName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-medium text-ink-soft">
                      {firstName.charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-display text-base font-semibold text-ink">
                  {fullName}
                </p>
                {headline && (
                  <p className="text-sm text-ink-soft">{headline}</p>
                )}

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

                {bio && (
                  <p className="mt-3 text-xs leading-relaxed text-ink-soft">
                    {bio}
                  </p>
                )}

                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-postal-red px-4 py-2 text-xs font-medium text-white">
                  <ChatIcon className="h-3.5 w-3.5" />
                  Ask me a question
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-lavender/30 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-lavender text-ink">
                <EyeIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-ink">
                  Tips for a great profile
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {profileTips.map((tip) => (
                    <li
                      key={tip}
                      className="flex items-start gap-1.5 text-xs text-ink-soft"
                    >
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </form>
    </section>
  )
}
