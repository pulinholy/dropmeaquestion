import { supabase } from "@/lib/supabase"
import { notFound } from "next/navigation"
import QuestionForm from "@/components/QuestionForm"

export default async function ExpertPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, username")
    .eq("username", username)
    .single()

  if (!profile) {
    notFound()
  }

  const { data: expert } = await supabase
    .from("experts")
    .select("headline, bio, price_cents, response_window_hours, is_active")
    .eq("id", (await supabase.from("profiles").select("id").eq("username", username).single()).data?.id)
    .single()

  if (!expert || !expert.is_active) {
    notFound()
  }

  const price = (expert.price_cents / 100).toFixed(2)

  return (
    <main className="min-h-screen">
      <div
        className="h-2 w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, var(--color-postal-red) 0 16px, var(--color-paper) 16px 24px, var(--color-postal-blue) 24px 40px, var(--color-paper) 40px 48px)",
        }}
      />

      <div className="mx-auto max-w-xl px-6 py-16">
        <p className="text-sm text-ink-soft">@{profile.username}</p>
        <h1 className="mt-1 font-display text-3xl text-ink">
          {profile.full_name}
        </h1>
        <p className="mt-1 text-ink-soft">{expert.headline}</p>
        <p className="mt-4 text-ink">{expert.bio}</p>

        <div className="mt-8 rounded-sm border border-line p-6">
          <p className="text-sm text-ink-soft">
            ${price} per question &middot; answered within{" "}
            {expert.response_window_hours}h
          </p>

          <QuestionForm
  expertId={profile.id}
  price={price}
  responseWindowHours={expert.response_window_hours}
/>
        </div>
      </div>
    </main>
  )
}