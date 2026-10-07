import type { Metadata } from "next"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { FOLLOW_UP_POLICY_LINES, FOLLOW_UP_PRIVACY_LINES } from "@/lib/follow-up-rules"
import JoinPanel from "./join-panel"

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
  const { data: call } = await supabaseAdmin
    .from("follow_up_calls")
    .select("id, status, confirmed_start, asker_timezone, expert_id")
    .eq("id", followUpId)
    .maybeSingle()

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
          />
          <div className="mt-8 rounded-lg border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">Good to know</h2>
            <ul className="mt-2 space-y-1.5 text-xs text-ink-soft">
              {FOLLOW_UP_POLICY_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
              {FOLLOW_UP_PRIVACY_LINES.map((line) => (
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
    } else {
      content = (
        <Message title="This conversation isn’t scheduled">
          It was cancelled or didn&apos;t go ahead. If your card was held, the
          hold has been released.
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
