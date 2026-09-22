import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { notFound } from "next/navigation"
import QuestionForm from "@/components/QuestionForm"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"

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

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="h-16 w-16 flex-shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border border-line bg-line/40 text-lg font-medium text-ink-soft">
              {profile.full_name?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div>
            <p className="text-sm text-ink-soft">@{profile.username}</p>
            <h1 className="mt-1 font-display text-3xl text-ink">
              {profile.full_name}
            </h1>
          </div>
        </div>
        <p className="mt-1 text-ink-soft">{expert.headline}</p>
        <p className="mt-4 text-ink">{expert.bio}</p>

        <div className="mt-8 rounded-sm border border-line p-6">
        {!expert.is_active ? (
  <p className="text-sm text-ink-soft">
    I&apos;m not taking new questions right now — check back soon!
  </p>
) : (
  <>
    <p className="text-sm text-ink-soft">
      ${price} per question &middot; answered within{" "}
      {expert.response_window_hours}h
    </p>

    {expert.stripe_onboarded ? (
      <QuestionForm
        expertId={profile.id}
        username={profile.username}
        price={price}
      />
    ) : (
      <p className="mt-4 text-sm text-ink-soft">
        This expert hasn&apos;t finished setting up payments yet — check back
        soon.
      </p>
    )}
  </>
)}
        </div>
      </div>

      <SiteFooter />
    </main>
  )
}