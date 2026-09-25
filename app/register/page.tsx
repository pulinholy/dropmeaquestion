"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import SiteFooter from "@/components/SiteFooter"
import TopicInput from "@/components/TopicInput"
import { slugify } from "@/lib/slugify"
import {
  PersonIcon,
  DocumentIcon,
  DollarSignIcon,
  EyeIcon,
  EyeOffIcon,
} from "@/components/icons"

const MIN_PRICE = 5
const PLATFORM_FEE_RATE = 0.15
const MAX_BIO_LENGTH = 500

function FormSection({
  icon: Icon,
  iconBg,
  iconText,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconText: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-6 shadow-sm sm:p-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[220px_1fr]">
        <div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg} ${iconText}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="mt-3 font-display text-xl text-ink">{title}</h2>
          <p className="mt-2 text-sm text-ink-soft">{description}</p>
        </div>
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [headline, setHeadline] = useState("")
  const [bio, setBio] = useState("")
  const [topics, setTopics] = useState<string[]>([])
  const [price, setPrice] = useState("10")
  const [responseWindowHours, setResponseWindowHours] = useState("24")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [username, setUsername] = useState("")
  const [usernameError, setUsernameError] = useState("")

  const priceValue = parseFloat(price)
  const isPriceBelowMinimum = !isNaN(priceValue) && priceValue < MIN_PRICE
  const netEarnings =
    !isNaN(priceValue) && priceValue >= MIN_PRICE
      ? (priceValue * (1 - PLATFORM_FEE_RATE)).toFixed(2)
      : null

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
      <div className="h-1 w-full bg-postal-red" />
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between border-b border-line px-6 py-6">
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
        <p className="text-sm text-ink-soft">
          Already have a page?{" "}
          <a
            href="/login"
            className="font-medium text-ink underline decoration-line underline-offset-4 hover:text-postal-red"
          >
            Log in
          </a>
        </p>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="text-center">
          <h1 className="font-display text-4xl font-semibold text-ink">
            Start your page
          </h1>
          <p className="mt-2 text-ink-soft">
            Set up the basics. You can update everything later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <FormSection
            icon={PersonIcon}
            iconBg="bg-postal-blue/10"
            iconText="text-postal-blue"
            title="Account"
            description="This information helps create your account and unique page link."
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink">
                  First name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink placeholder:text-ink-soft/60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink">
                  Last name <span className="text-ink-soft">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Patel"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink placeholder:text-ink-soft/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">
                Choose your page link
              </label>
              <div className="mt-1 flex overflow-hidden rounded-sm border border-line">
                <span className="flex items-center whitespace-nowrap bg-line/30 px-3 text-sm text-ink-soft">
                  dropmeaquestion.com/
                </span>
                <input
                  type="text"
                  required
                  placeholder="your-name"
                  value={username}
                  onChange={(e) => checkUsername(e.target.value)}
                  className="w-full px-3 py-2 text-ink outline-none placeholder:text-ink-soft/60"
                />
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Use letters, numbers or hyphens. e.g. priya-patel
              </p>
              {usernameError && (
                <p className="mt-1 text-sm text-postal-red">{usernameError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">Email</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink placeholder:text-ink-soft/60"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Create a secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-sm border border-line px-3 py-2 pr-10 text-ink placeholder:text-ink-soft/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={DocumentIcon}
            iconBg="bg-green-500/10"
            iconText="text-green-700"
            title="Your expertise"
            description="Tell people about your background and what they can ask you."
          >
            <div>
              <label className="block text-sm font-medium text-ink">
                Professional title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Product Leader & Startup Advisor"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink placeholder:text-ink-soft/60"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">
                About you
              </label>
              <textarea
                required
                rows={3}
                maxLength={MAX_BIO_LENGTH}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a short bio about your experience and what you can help with. You can update this later."
                className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink placeholder:text-ink-soft/60"
              />
              <p className="mt-1 text-right text-xs text-ink-soft">
                {bio.length}/{MAX_BIO_LENGTH}
              </p>
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
          </FormSection>

          <FormSection
            icon={DollarSignIcon}
            iconBg="bg-postal-red/10"
            iconText="text-postal-red"
            title="Questions"
            description="Set your pricing and response time so people know what to expect."
          >
            <div>
              <label className="block text-sm font-medium text-ink">
                Price per question
              </label>
              <div className="mt-1 flex overflow-hidden rounded-sm border border-line">
                <span className="flex items-center bg-line/30 px-3 text-ink-soft">
                  $
                </span>
                <input
                  type="number"
                  required
                  min={MIN_PRICE}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 text-ink outline-none"
                />
                <span className="flex items-center whitespace-nowrap bg-line/30 px-3 text-sm text-ink-soft">
                  USD
                </span>
              </div>
              {netEarnings !== null ? (
                <p className="mt-1 text-xs text-ink-soft">
                  You receive ${netEarnings} on a ${price} question after
                  the {PLATFORM_FEE_RATE * 100}% platform fee. You can
                  change this anytime.
                </p>
              ) : (
                isPriceBelowMinimum && (
                  <p className="mt-1 text-sm text-postal-red">
                    Price per question must be at least ${MIN_PRICE}.
                  </p>
                )
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">
                Response time
              </label>
              <select
                value={responseWindowHours}
                onChange={(e) => setResponseWindowHours(e.target.value)}
                className="mt-1 w-full rounded-sm border border-line px-3 py-2 text-ink"
              >
                <option value="24">Within 24 hours</option>
                <option value="48">Within 48 hours</option>
              </select>
              <p className="mt-1 text-xs text-ink-soft">
                Let people know when they can expect your answer.
              </p>
            </div>
          </FormSection>

          {error && <p className="text-sm text-postal-red">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-ink px-6 py-3.5 text-base font-medium text-paper transition-colors hover:bg-postal-blue disabled:opacity-50"
          >
            {loading ? "Creating your page..." : "Create My Page"}
          </button>

          <p className="text-center text-xs text-ink-soft">
            By creating your page, you agree to our{" "}
            <a
              href="/terms"
              className="underline decoration-line underline-offset-4 hover:text-ink"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              className="underline decoration-line underline-offset-4 hover:text-ink"
            >
              Privacy Policy
            </a>
            .
          </p>
        </form>
      </div>

      <SiteFooter />
    </main>
  )
}
