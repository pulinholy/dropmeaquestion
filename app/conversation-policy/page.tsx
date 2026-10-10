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
          If technical problems prevent a conversation from taking place, open{" "}
          <strong>Having trouble connecting?</strong> on the conversation screen, try the basics,
          and request a new time at no additional charge if it still doesn&apos;t work. If
          something else went wrong, use{" "}
          <strong>Report a problem</strong> on your conversation page. We hold the charge, review
          what happened and decide. If a charge was made and you think it shouldn&apos;t have been,
          email{" "}
          <a
            href="mailto:hello@dropmeaquestion.com"
            className="font-medium text-ink underline underline-offset-2"
          >
            hello@dropmeaquestion.com
          </a>{" "}
          within 24 hours with the question number and we&apos;ll review it.
        </p>

        {mode === "dmq" && (
          <>
            <h2 className="mt-10 font-display text-xl text-ink">Requesting a new time</h2>
            <p className="mt-3 text-sm text-ink-soft">
              Either of you can request a new time, at no additional charge, only when all of
              these are true:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
              <li>
                The conversation has started and the room hasn&apos;t closed yet (it closes 5
                minutes after the scheduled end).
              </li>
              <li>
                You&apos;ve had less than 2 minutes together. If you were connected together for
                longer, use <strong>Report a problem</strong> instead and we&apos;ll review it.
              </li>
              <li>
                For the person who booked: the expert hasn&apos;t been waiting alone in the room
                for 2 minutes or more. That is treated as a missed conversation, not a technical
                problem.
              </li>
            </ul>
            <p className="mt-3 text-sm text-ink-soft">
              If you had 10 minutes or more together, the conversation is treated as having taken
              place and the normal completion and payment rules apply. Requesting a new time
              cancels this booking and releases the hold on the card; a new booking can then be
              requested if the 14-day period after the answer is still open. If a connection
              problem happens close to the end of that period, one replacement booking is allowed
              for 7 days after the failure.
            </p>
          </>
        )}

        <p className="mt-10 border-t border-line pt-4 text-xs text-ink-soft">
          Policy version {followUpPolicyVersion(mode)}.
        </p>
      </div>

      <SiteFooter />
    </main>
  )
}
