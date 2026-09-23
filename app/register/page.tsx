"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import TopicInput from "@/components/TopicInput"
import { slugify } from "@/lib/slugify"

const MIN_PRICE = 5

export default function RegisterPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [headline, setHeadline] = useState("")
  const [bio, setBio] = useState("")
  const [topics, setTopics] = useState<string[]>([])
  const [price, setPrice] = useState("10")
  const [responseWindowHours, setResponseWindowHours] = useState("24")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [username, setUsername] = useState("")
  const [usernameError, setUsernameError] = useState("")

  async function checkUsername(value: string) {
  const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, "")
  setUsername(clean)

  if (clean.length < 3) {
    setUsernameError("Username must be at least 3 characters.")
    return
  }

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("username", clean)
    .maybeSingle()

  if (data) {
    setUsernameError("That username is already taken.")
  } else {
    setUsernameError("")
  }
}
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
if (usernameError || username.length < 3) {
    setError("Please choose a valid, available username first.")
    setLoading(false)
    return
  }
  if (parseFloat(price) < MIN_PRICE) {
    setError(`Price per question must be at least $${MIN_PRICE}.`)
    setLoading(false)
    return
  }
    // Step 1: create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError || !authData.user) {
      setError(authError?.message || "Something went wrong creating your account.")
      setLoading(false)
      return
    }

    const userId = authData.user.id

    // Step 2: create their profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      username: username,
      is_expert: true,
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    // Step 3: create their expert record
    const { error: expertError } = await supabase.from("experts").insert({
      id: userId,
      headline,
      bio,
      price_cents: Math.round(parseFloat(price) * 100),
      response_window_hours: parseInt(responseWindowHours, 10),
    })

    if (expertError) {
      setError(expertError.message)
      setLoading(false)
      return
    }

    // Step 4: save their "ask me about" topics, if any
    if (topics.length > 0) {
      const { error: topicsError } = await supabase.from("expert_topics").insert(
        topics.map((name, index) => ({
          expert_id: userId,
          name,
          slug: slugify(name),
          sort_order: index,
        }))
      )

      if (topicsError) {
        setError(topicsError.message)
        setLoading(false)
        return
      }
    }

    setLoading(false)
    router.push("/register/success")
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-3xl text-ink">Start your page</h1>
      <p className="mt-2 text-ink-soft">
        A few basics — you can add more later.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
    Choose your link
  </label>
  <div className="mt-1 flex items-center rounded-sm border border-line">
    <span className="pl-3 text-sm text-ink-soft">dropmeaquestion.com/</span>
    <input
      type="text"
      required
      value={username}
      onChange={(e) => checkUsername(e.target.value)}
      className="w-full rounded-sm py-2 pr-2 text-ink outline-none"
    />
  </div>
  {usernameError && (
    <p className="mt-1 text-sm text-postal-red">{usernameError}</p>
  )}
</div>

        <div>
          <label className="block text-sm font-medium text-ink">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">
            Title/Headline (eg. Founder, Startup Adviser)
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
          <label className="block text-sm font-medium text-ink">Short bio</label>
          <textarea
            required
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="e.g. I've spent 8 years leading engineering teams at fast-growing startups, and now help founders make smart technical hiring and architecture decisions."
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink placeholder:text-ink-soft/60"
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

        <div>
          <label className="block text-sm font-medium text-ink">
            {`Price per question (USD, $${MIN_PRICE} minimum)`}
          </label>
          <input
            type="number"
            required
            min={MIN_PRICE}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">
            Answer within
          </label>
          <select
            value={responseWindowHours}
            onChange={(e) => setResponseWindowHours(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
          >
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
          </select>
        </div>

        {error && <p className="text-sm text-postal-red">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-postal-blue disabled:opacity-50"
        >
          {loading ? "Creating your page..." : "Create My Page"}
        </button>
      </form>
      </div>

      <SiteFooter />
    </main>
  )
}