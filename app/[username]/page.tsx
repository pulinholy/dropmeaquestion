import type { Metadata } from "next"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { notFound } from "next/navigation"
import QuestionForm from "@/components/QuestionForm"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import { PUBLIC_SITE_URL } from "@/lib/site"

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

  const price = (expert.price_cents / 100).toFixed(2)
  const firstName = profile.full_name?.split(" ")[0] || profile.full_name

  return (
    <main className="min-h-screen">
      <SiteHeader variant="asker" />

      <section className="border-t border-line">
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="mx-auto h-20 w-20 flex-shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <div className="mx-auto flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border border-line bg-paper text-xl font-medium text-ink-soft">
              {profile.full_name?.charAt(0).toUpperCase() || "?"}
            </div>
          )}

          <p className="mt-4 font-display text-2xl text-ink">
            {profile.full_name}
          </p>
          <p className="text-sm text-ink-soft">@{profile.username}</p>
          {expert.headline && (
            <p className="mt-2 text-ink-soft">{expert.headline}</p>
          )}
          {expert.bio && (
            <p className="mt-4 text-sm text-ink">{expert.bio}</p>
          )}

          <div className="mt-6 border-t border-line pt-6">
            {!expert.is_active ? (
              <p className="text-sm text-ink-soft">
                I&apos;m not taking new questions right now — check back
                soon!
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-soft">
                  ${price} &middot; {expert.response_window_hours} hour
                  response
                </p>

                <ul className="mt-3 space-y-1 text-left text-xs text-ink-soft">
                  <li>
                    &bull; When you ask, your card is authorized for ${price}
                    — not charged yet.
                  </li>
                  <li>
                    &bull; {firstName} has {expert.response_window_hours}{" "}
                    hours to answer.
                  </li>
                  <li>&bull; Answered — you&apos;re charged. No answer — no charge.</li>
                </ul>

                {expert.stripe_onboarded ? (
                  <QuestionForm
                    expertId={profile.id}
                    username={profile.username}
                    price={price}
                  />
                ) : (
                  <p className="mt-4 text-sm text-ink-soft">
                    This expert hasn&apos;t finished setting up payments yet
                    — check back soon.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
