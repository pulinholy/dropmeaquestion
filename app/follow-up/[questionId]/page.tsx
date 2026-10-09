import type { Metadata } from "next"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import {
  getFollowUpOffer,
  formatPrice,
  followUpPolicyLines,
  followUpPrivacyLines,
  followUpPolicyVersion,
} from "@/lib/follow-up"
import { videoMode } from "@/lib/video/config"
import BookingForm from "./booking-form"
import RequestStatus from "./request-status"

export const metadata: Metadata = {
  title: "Book a conversation — Drop Me A Question",
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

export default async function FollowUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>
  searchParams: Promise<{ requested?: string }>
}) {
  const { questionId } = await params
  const { requested } = await searchParams
  const offer = await getFollowUpOffer(questionId)

  let content: React.ReactNode

  if (!offer.ok && offer.existing) {
    const status = offer.existing.status
    content =
      status === "requested" ? (
        <Message title="Your request has been sent">
          The expert has 24 hours to confirm a time. We&apos;ll email you as soon
          as they do. Your card is held, not charged.
        </Message>
      ) : status === "confirmed" ? (
        <Message title="Your conversation is booked">
          Check your email for the time and how to join.
        </Message>
      ) : (
        <Message title="This conversation has already been booked">
          A follow-up conversation has already been arranged for this question.
        </Message>
      )
  } else if (!offer.ok) {
    content =
      offer.reason === "not_found" ? (
        <Message title="This link isn’t valid">
          We couldn&apos;t find a conversation offer for this link.
        </Message>
      ) : offer.reason === "offer_expired" ? (
        <Message title="This offer has ended">
          Conversation offers are available for 14 days after an answer.
        </Message>
      ) : (
        <Message title="Not available right now">
          A follow-up conversation isn&apos;t available for this question.
        </Message>
      )
  } else if (requested === "1") {
    content = (
      <RequestStatus
        questionId={offer.question.id}
        expertFirstName={offer.expert.firstName}
      />
    )
  } else {
    content = (
      <BookingForm
        questionId={offer.question.id}
        expertFirstName={offer.expert.firstName}
        referenceId={offer.question.referenceId}
        price={formatPrice(offer.priceCents)}
        policyLines={followUpPolicyLines(videoMode())}
        privacyLines={followUpPrivacyLines(videoMode())}
        policyVersion={followUpPolicyVersion(videoMode())}
      />
    )
  }

  return (
    <main className="min-h-screen">
      <SiteHeader variant="asker" />
      {content}
      <SiteFooter />
    </main>
  )
}
