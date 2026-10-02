import type { Metadata } from "next"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { notFound } from "next/navigation"
import QuestionForm from "@/components/QuestionForm"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import ExpertBio from "@/components/ExpertBio"
import {
  ChatIcon,
  LightningIcon,
  LockIcon,
  SparkleIcon,
} from "@/components/icons"
import { PUBLIC_SITE_URL } from "@/lib/site"
import { formatResponseWindow, formatPrice } from "@/lib/format"

// Rotating background tints for topic pills -- real topics are free-text, so
// there's no reliable way to pick a matching icon per topic. A rotating
// pattern gives visual rhythm without pretending to understand the topic.
const TOPIC_STYLES = ["bg-lavender/60", "bg-postal-blue/10", "bg-line/50"]

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("username", username)
    .maybeSingle()

  if (!profile) {
    return { title: "Drop Me A Question" }
  }

  const { data: expert } = await supabaseAdmin
    .from("experts")
    .select("headline, deactivated_at, is_demo")
    .eq("id", profile.id)
    .maybeSingle()

  if (!expert || expert.deactivated_at) {
    return { title: "Drop Me A Question" }
  }

  if (expert.is_demo) {
    return {
      title: "Example profile — Drop Me A Question",
      robots: { index: false, follow: true },
    }
  }

  const firstName = profile.full_name?.split(" ")[0] || profile.full_name
  const title = `Ask ${firstName} a question — Drop Me A Question`
  const description = expert?.headline
    ? `${expert.headline} — get a real, accountable answer from ${firstName} on Drop Me A Question.`
    : `Get a real, accountable answer from ${firstName} on Drop Me A Question.`
  const image = profile.avatar_url || `${PUBLIC_SITE_URL}/brand/logo-lockup.png`
  const url = `${PUBLIC_SITE_URL}/${username}`

  return {
    title,
    description,
    openGraph: { title, description, images: [image], url, siteName: "Drop Me A Question" },
    twitter: { card: "summary", title, description, images: [image] },
  }
}

export default async function ExpertPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .eq("username", username)
    .single()

  if (!profile) {
    notFound()
  }

  const { data: expert } = await supabaseAdmin
    .from("experts")
    .select(
      "headline, bio, price_cents, response_window_hours, is_active, stripe_onboarded, pause_message, deactivated_at, is_demo"
    )
    .eq("id", profile.id)
    .maybeSingle()

  if (!expert) {
    notFound()
  }

  // Admin-deactivated -- unlike pausing (self-service, still shows the full
  // profile), this hides everything. No bio, no topics, nothing
  // expert-identifying, regardless of why it was deactivated.
  if (expert.deactivated_at) {
    return (
      <main className="min-h-screen">
        <SiteHeader variant="asker" />
        <section className="border-t border-line">
          <div className="mx-auto max-w-[600px] px-6 py-20 text-center">
            <h1 className="font-display text-2xl text-ink">
              This page isn&apos;t available
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              The page you&apos;re looking for doesn&apos;t exist or is no
              longer active.
            </p>
          </div>
        </section>
        <SiteFooter />
      </main>
    )
  }

  const { data: topics } = await supabaseAdmin
    .from("expert_topics")
    .select("name")
    .eq("expert_id", profile.id)
    .order("sort_order", { ascending: true })

  const price = formatPrice(expert.price_cents)
  const firstName = profile.full_name?.split(" ")[0] || profile.full_name
  const topicNames = topics?.map((t) => t.name) ?? []
  const isDemo = Boolean(expert.is_demo)

  return (
    <main className="min-h-screen">
      <SiteHeader variant={isDemo ? "default" : "asker"} />

      <section className="border-t border-line">
        <div className="mx-auto max-w-[600px] px-6 pb-10 pt-8">
          {isDemo && (
            <div className="mb-8 flex items-center gap-4 rounded-lg border border-postal-red/25 bg-postal-red/10 px-5 py-4 text-left">
              <SparkleIcon className="h-8 w-8 flex-shrink-0 text-postal-red" />
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-postal-red">
                  Example profile
                </p>
                <p className="mt-0.5 text-sm text-ink">
                  See what a Drop Me A Question profile looks like. This is a
                  demo&nbsp;—{" "}
                  <strong className="whitespace-nowrap font-semibold">
                    no payment will be processed.
                  </strong>
                </p>
              </div>
            </div>
          )}

          <div className="text-center">
            <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
              <div className="absolute h-32 w-32 rounded-full bg-lavender/40" />
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="relative h-28 w-28 flex-shrink-0 rounded-full border-4 border-paper object-cover"
                />
              ) : (
                <div className="relative flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-full border-4 border-paper bg-paper text-3xl font-medium text-ink-soft">
                  {profile.full_name?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
            </div>

            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {profile.full_name}
            </p>
            {expert.headline && (
              <p className="mt-1 text-base font-semibold text-ink">
                {expert.headline}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-soft/70">
              @{profile.username}
            </p>

            {expert.bio && <ExpertBio bio={expert.bio} />}

            {topicNames.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold text-ink">Ask me about</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {topicNames.map((topic, i) => (
                    <span
                      key={topic}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink ${TOPIC_STYLES[i % TOPIC_STYLES.length]}`}
                    >
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink/40" />
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-lg border border-line bg-white p-5 shadow-sm sm:p-6">
            {isDemo || expert.is_active ? (
              <>
                <div className="flex items-center gap-3 text-left">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-postal-red text-white">
                    <ChatIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-display text-2xl font-semibold text-ink">
                      Ask {firstName} a question
                    </p>
                    <p className="text-sm text-ink-soft">
                      ${price} per question &middot; Replies within{" "}
                      {formatResponseWindow(expert.response_window_hours)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  {isDemo || expert.stripe_onboarded ? (
                    <QuestionForm
                      expertId={profile.id}
                      username={profile.username}
                      price={price}
                      expertFirstName={firstName}
                      responseWindowHours={expert.response_window_hours}
                      topics={topicNames}
                      demo={isDemo}
                    />
                  ) : (
                    <p className="text-sm text-ink-soft">
                      This expert hasn&apos;t finished setting up payments yet
                      — check back soon.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-start gap-4 text-left">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-line/40 text-ink-soft">
                  <ChatIcon className="h-7 w-7" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-line/50 px-3 py-1 text-xs font-medium text-ink-soft">
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-soft/60" />
                    Not accepting questions
                  </span>
                  <p className="mt-2 font-display text-xl font-semibold text-ink">
                    {firstName} isn&apos;t taking questions right now.
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {expert.pause_message ||
                      `Check back soon — ${firstName} will reopen questions when available.`}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-postal-red/10 text-postal-red">
                <ChatIcon className="h-5 w-5" />
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">
                Ask directly
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Get an answer from {firstName}
              </p>
            </div>
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
                <LightningIcon className="h-5 w-5" />
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">
                Response time
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Within {formatResponseWindow(expert.response_window_hours)}
              </p>
            </div>
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-700">
                <LockIcon className="h-5 w-5" />
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">
                Protected payment
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Pay only if answered
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
