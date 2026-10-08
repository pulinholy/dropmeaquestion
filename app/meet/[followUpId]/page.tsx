import type { Metadata } from "next"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  followUpPolicyLines,
  followUpPrivacyLines,
  formatPrice,
} from "@/lib/follow-up-rules"
import { videoMode } from "@/lib/video/config"
import JoinPanel from "./join-panel"
import AskerActions from "./asker-actions"

export const metadata: Metadata = {
  title: "Your conversation — Drop Me A Question",
  robots: { index: false, follow: false },
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="font-display text-3xl text-ink">{title}</h1>
      <p className="mt-3 text-ink-soft">{children}</p>
    </div>
  )
}

export default async function MeetPage({
  params,
}: {
  params: Promise<{ followUpId: string }>
}) {
  const { followUpId } = await params

  // Never selects the meeting link: it only leaves the server through the
  // join endpoint, while the join window is open.
  // The new column is only read when DMQ rooms are switched on.
  const dmqOn = videoMode() === "dmq"
  const { data: callRow } = await supabaseAdmin
    .from("follow_up_calls")
    .select(
      dmqOn
        ? "id, status, confirmed_start, asker_timezone, expert_id, price_cents, video_provider"
        : "id, status, confirmed_start, asker_timezone, expert_id, price_cents"
    )
    .eq("id", followUpId)
    .maybeSingle()
  const call = callRow as unknown as {
    id: string
    status: string
    confirmed_start: string | null
    asker_timezone: string | null
    expert_id: string
    price_cents: number
    video_provider?: string | null
  } | null
  const videoProvider = dmqOn && call?.video_provider === "dmq" ? "dmq" : "external"

  let content: React.ReactNode

  if (!call) {
    content = (
      <Message title="This link isn’t valid">
        We couldn&apos;t find a conversation for this link.
      </Message>
    )
  } else {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", call.expert_id)
      .maybeSingle()
    const expertFirstName = profile?.full_name?.split(" ")[0] || "your expert"

    if (call.status === "confirmed" && call.confirmed_start) {
      content = (
        <div className="mx-auto max-w-xl px-6 py-12">
          <JoinPanel
            followUpId={call.id}
            expertFirstName={expertFirstName}
            startIso={call.confirmed_start}
            timezone={call.asker_timezone}
            videoProvider={videoProvider}
          />
          {dmqOn && videoProvider === "external" && (
            <p className="mt-3 rounded-lg border border-line bg-white p-3 text-center text-xs text-ink-soft">
              This conversation uses {expertFirstName}&apos;s own meeting link, which opens
              when you join.
            </p>
          )}
          <AskerActions
            followUpId={call.id}
            startIso={call.confirmed_start}
            price={formatPrice(call.price_cents)}
          />
          <div className="mt-8 rounded-lg border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Good to know</h2>
            <ul className="mt-2 space-y-1.5 text-xs text-ink-soft">
              {followUpPolicyLines(videoMode()).map((line) => (
                <li key={line}>{line}</li>
              ))}
              {followUpPrivacyLines(videoMode()).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      )
    } else if (call.status === "completed") {
      content = (
        <Message title="This conversation has taken place">
          Thanks for talking with {expertFirstName}.
        </Message>
      )
    } else if (call.status === "requested") {
      content = (
        <Message title="Waiting for confirmation">
          {expertFirstName} hasn&apos;t confirmed a time yet. We&apos;ll email you
          as soon as they do. Your card is held, not charged.
        </Message>
      )
    } else if (call.status === "late_cancelled" || call.status === "asker_no_show") {
      content = (
        <Message title="This conversation is over">
          Your card was charged for it, as described in the cancellation policy
          you agreed to when booking.
        </Message>
      )
    } else if (call.status === "disputed") {
      content = (
        <Message title="We’re reviewing this conversation">
          A problem was reported. Your card won&apos;t be charged unless we find
          it took place, and we&apos;ll email you once it&apos;s settled.
        </Message>
      )
    } else {
      content = (
        <Message title="This conversation isn’t scheduled">
          It was cancelled or didn&apos;t go ahead. If your card was held, the
          hold has been released and you weren&apos;t charged.
        </Message>
      )
    }
  }

  return (
    <main className="min-h-screen">
      <SiteHeader variant="asker" />
      {content}
      <SiteFooter />
    </main>
  )
}
