import { ClockIcon, VideoIcon } from "@/components/icons"

// A made-up booked conversation, the follow-up to the sample answer card: what
// the expert and asker see once a time is confirmed. The person and the
// question are invented, and the card says so.
export default function SampleConversationCard() {
  return (
    <figure aria-label="Example conversation" className="relative mx-auto w-full max-w-md px-2 pt-4">
      <span className="absolute -top-1 left-6 z-10 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-sm">
        Example conversation
      </span>

      <div className="relative -rotate-[1.5deg] rounded-md border border-line bg-white p-6 shadow-lg sm:p-7">
        <span
          aria-hidden="true"
          className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-2 rounded-[2px] bg-postal-red/20 shadow-sm"
        />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-postal-red">
              15-MINUTE CONVERSATION
            </p>
            <p className="mt-1 font-display text-xl text-ink">with Nora Whitfield</p>
            <p className="text-xs text-ink-soft">Family Travel Planner</p>
          </div>
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-postal-red/10 text-postal-red">
            <VideoIcon className="h-5 w-5" />
          </span>
        </div>

        <hr className="my-4 border-line" />

        <p className="text-[10px] font-semibold tracking-[0.12em] text-ink-soft">ABOUT YOUR QUESTION</p>
        <p className="mt-1 text-sm leading-snug text-ink-soft">
          We have 4 days in Lisbon with a toddler. What should we skip?
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-sm bg-[#f1f7f2] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            <ClockIcon className="h-4 w-4 flex-shrink-0 text-green-700" />
            Thursday, 3:30 PM
          </span>
          <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
            Confirmed
          </span>
        </div>

        <span
          aria-hidden="true"
          className="mt-4 flex w-full items-center justify-center rounded-full bg-line px-6 py-3 text-sm font-medium text-ink-soft"
        >
          Join opens 10 minutes before
        </span>
        <p className="mt-2 text-center text-xs text-ink-soft">
          A private video call on Drop Me A Question. Camera optional, nothing to install.
        </p>

        <p className="mt-5 border-t border-line pt-3 text-center text-[10px] text-ink-soft">
          Powered by <span className="font-semibold text-postal-red">Drop Me A Question</span>
        </p>
      </div>
    </figure>
  )
}
