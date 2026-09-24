import type { Metadata } from "next"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { notFound } from "next/navigation"
import QuestionForm from "@/components/QuestionForm"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import { ChatIcon, LightningIcon, LockIcon } from "@/components/icons"
import { PUBLIC_SITE_URL } from "@/lib/site"

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
    .select("headline")
    .eq("id", profile.id)
    .maybeSingle()

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
    .select("headline, bio, price_cents, response_window_hours, is_active, stripe_onboarded")
    .eq("id", profile.id)
    .maybeSingle()

  if (!expert) {
    notFound()
  }

  const { data: topics } = await supabaseAdmin
    .from("expert_topics")
    .select("name")
    .eq("expert_id", profile.id)
    .order("sort_order", { ascending: true })

  const price = (expert.price_cents / 100).toFixed(2)
  const firstName = profile.full_name?.split(" ")[0] || profile.full_name
  const topicNames = topics?.map((t) => t.name) ?? []

  return (
    <main className="min-h-screen">
      <SiteHeader variant="asker" />

      <section className="border-t border-line">
        <div className="mx-auto max-w-lg px-6 py-16">
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
              {expert.is_active && (
                <span className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-paper bg-green-500" />
              )}
            </div>

            <p className="mt-5 font-display text-3xl font-semibold text-ink">
              {profile.full_name}
            </p>
            {expert.headline && (
              <p className="mt-1 text-lg font-semibold text-ink">
                {expert.headline}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-soft/70">
              @{profile.username}
            </p>

            {expert.bio && (
              <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-ink">
                {expert.bio}
              </p>
            )}

            {topicNames.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
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
            )}
          </div>

          <div className="mt-8 rounded-lg border border-line bg-white p-6 shadow-sm sm:p-8">
            {expert.is_active ? (
              <>
                <div className="flex items-center gap-3 text-left">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-postal-red/10 text-postal-red">
                    <ChatIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-display text-xl text-ink">
                      Ask {firstName} a question
                    </p>
                    <p className="text-sm text-ink-soft">
                      ${price} per question &middot; Replies within{" "}
                      {expert.response_window_hours} hours
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  {expert.stripe_onboarded ? (
                    <QuestionForm
                      expertId={profile.id}
                      username={profile.username}
                      price={price}
                      expertFirstName={firstName}
                      responseWindowHours={expert.response_window_hours}
                      topics={topicNames}
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
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-line/50 text-ink-soft">
                  <ChatIcon className="h-6 w-6" />
                </div>
                <p className="text-sm text-ink-soft">
                  I&apos;m not taking new questions right now — check back
                  soon!
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 text-center sm:grid-cols-3">
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
                <ChatIcon className="h-5 w-5" />
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">
                Ask directly
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Get practical advice and expert insights
              </p>
            </div>
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
                <LightningIcon className="h-5 w-5" />
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">
                Fast response
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Replies within {expert.response_window_hours} hours
              </p>
            </div>
            <div>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-postal-blue/10 text-postal-blue">
                <LockIcon className="h-5 w-5" />
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">
                Secure payment
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Only charged if answered in time
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
