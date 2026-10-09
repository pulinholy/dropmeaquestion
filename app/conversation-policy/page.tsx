import type { Metadata } from "next"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import {
  followUpPolicyLines,
  followUpPrivacyLines,
  followUpPolicyVersion,
} from "@/lib/follow-up-rules"
import { videoMode } from "@/lib/video/config"

export const metadata: Metadata = {
  title: "Conversation & Cancellation Policy — Drop Me A Question",
  description:
    "How payment, cancellation, no-shows, problems and privacy work for paid 15-minute follow-up conversations.",
}

// The wording depends on how conversations are held, so it is read when the
// page is requested, not when the site is built.
export const dynamic = "force-dynamic"

export default function ConversationPolicyPage() {
  const mode = videoMode()
  const policy = followUpPolicyLines(mode)
  const privacy = followUpPrivacyLines(mode)

  return (
    <main className="min-h-screen">
      <SiteHeader variant="asker" />

      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-display text-3xl text-ink">Conversation &amp; Cancellation Policy</h1>
        <p className="mt-3 text-ink-soft">
          This applies to the optional, paid 15-minute follow-up conversations an expert can offer
          after answering your question. You agree to it when you request a conversation.
        </p>

        <h2 className="mt-10 font-display text-xl text-ink">Payment, cancellation and no-shows</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
          {policy.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <h2 className="mt-10 font-display text-xl text-ink">Privacy</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
          {privacy.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <h2 className="mt-10 font-display text-xl text-ink">If something goes wrong</h2>
        <p className="mt-3 text-sm text-ink-soft">
          Once a conversation has started, use <strong>Report a problem</strong> on your
          conversation page. We hold the charge, review what happened and decide. If a charge was
          made and you think it shouldn&apos;t have been, email{" "}
          <a
            href="mailto:hello@dropmeaquestion.com"
            className="font-medium text-ink underline underline-offset-2"
          >
            hello@dropmeaquestion.com
          </a>{" "}
          within 24 hours with the question number and we&apos;ll review it.
        </p>

        <p className="mt-10 border-t border-line pt-4 text-xs text-ink-soft">
          Policy version {followUpPolicyVersion(mode)}.
        </p>
      </div>

      <SiteFooter />
    </main>
  )
}
