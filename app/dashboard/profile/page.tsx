"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useProfileInfo } from "../profile-context"
import TopicInput from "@/components/TopicInput"
import { slugify } from "@/lib/slugify"

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

  useEffect(() => {
    load()
  }, [])

  async function load() {
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

  return (
    <div className="max-w-md space-y-8">
      <div>
        <label className="block text-sm font-medium text-ink">
          Profile picture
        </label>
        <div className="mt-2 flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Your profile picture"
              className="h-16 w-16 rounded-full border border-line object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-line/40 text-lg font-medium text-ink-soft">
              {firstName.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <label className="cursor-pointer rounded-sm border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-line">
            {uploadingAvatar ? "Uploading..." : "Upload photo"}
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
              className="hidden"
            />
          </label>
        </div>
        {avatarError && (
          <p className="mt-2 text-sm text-postal-red">{avatarError}</p>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink">
              First name
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">
              Last name <span className="text-ink-soft">(optional)</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">
            Headline (e.g. &quot;Senior iOS Developer, 8 yrs&quot;)
          </label>
          <input
            type="text"
            required
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">
            Short bio
          </label>
          <textarea
            required
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">
            What can people ask you about?
          </label>
          <p className="mt-1 text-sm text-ink-soft">
            Add up to 5 topics that describe your expertise.
          </p>
          <div className="mt-2">
            <TopicInput topics={topics} onChange={setTopics} />
          </div>
        </div>

        {error && <p className="text-sm text-postal-red">{error}</p>}
        {saved && <p className="text-sm text-postal-blue">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-postal-blue disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  )
}
