import localFont from "next/font/local"

// The handwriting used for the signature (Caveat, SIL Open Font License; see
// assets/fonts/Caveat-OFL.txt). A small copy with just the basic Latin letters
// the card needs, about 34 KB instead of the full 400 KB file the PDF uses.
const handwriting = localFont({
  src: "../assets/fonts/Caveat-Latin-Basic.woff2",
  weight: "400",
  display: "swap",
  preload: false,
})

// A made-up exchange that shows what an asker receives: the same layout as the
// real answer PDF, on a slightly tilted sheet of paper. The person and the
// question are invented, and the card says so.
export default function SampleAnswerCard() {
  return (
    <figure aria-label="Example answer" className="relative mx-auto w-full max-w-md px-2 pt-4">
      <span className="absolute -top-1 right-6 z-10 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-sm">
        Example answer
      </span>

      <div className="relative rotate-[1.5deg] rounded-md border border-line bg-white p-6 shadow-lg sm:p-7">
        <span
          aria-hidden="true"
          className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-3 rounded-[2px] bg-lavender/80 shadow-sm"
        />

        <p className="text-[10px] font-semibold tracking-[0.12em] text-postal-red">
          A PERSONAL ANSWER FROM
        </p>
        <p className="mt-1 font-display text-xl text-ink">Nora Whitfield</p>
        <p className="text-xs text-ink-soft">Family Travel Planner</p>

        <hr className="my-4 border-line" />

        <p className="text-[10px] font-semibold tracking-[0.12em] text-ink-soft">YOUR QUESTION</p>
        <p className="mt-1 text-sm leading-snug text-ink-soft">
          We have 4 days in Lisbon with a toddler. What should we skip?
        </p>

        <div className="mt-4 rounded-sm border-l-[3px] border-postal-red bg-[#fdf3f0] px-4 py-4">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-postal-red">MY ANSWER</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">
            Skip the Tram 28 queue and take the metro instead. It&apos;s much less waiting with a
            stroller. Do one big thing a day, such as Belém in the morning, then an easy afternoon
            at the Oceanário. Book Sintra for day three, but pick just one palace. Hope that helps!
          </p>
        </div>

        <div className="mt-5">
          <p className="text-sm text-ink">Warm regards,</p>
          <p
            className={`${handwriting.className} mt-0.5 -rotate-2 origin-left text-4xl leading-none text-[#d4533f]`}
          >
            Nora Whitfield
          </p>
          <p className="mt-1 text-xs text-ink-soft">Family Travel Planner</p>
        </div>

        <p className="mt-5 border-t border-line pt-3 text-center text-[10px] text-ink-soft">
          Powered by <span className="font-semibold text-postal-red">Drop Me A Question</span>
        </p>
      </div>
    </figure>
  )
}
