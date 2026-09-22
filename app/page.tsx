export default function Home() {
  return (
    <main className="min-h-screen">
      <div
        className="h-2 w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, var(--color-postal-red) 0 16px, var(--color-paper) 16px 24px, var(--color-postal-blue) 24px 40px, var(--color-paper) 40px 48px)",
        }}
      />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg tracking-tight text-ink">
          Drop Me A Question
        </span>
        
       <a   href="#ask-instead"
          className="text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
        >
          Looking to ask a question instead?
        </a>
      </header>

      {/* Hero — written for the expert */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-20">
        <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
          People already have questions.
          <br />
          You already have the answers.
        </h1>
        <p className="mt-3 font-display text-2xl italic text-postal-red sm:text-3xl">
          Now, get paid for them.
        </p>
        <p className="mt-6 max-w-xl text-lg text-ink-soft">
          Set a price, share one link, and get paid for the expertise
          you&apos;re already giving away for free — in DMs, comments, and
          emails.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          
          <a  href="/register"
            className="rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-postal-blue"
          >
            Start Your Page
          </a>
          
         <a     href="#how"
            className="text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* How it works — from the expert's side */}
      <section id="how" className="border-t border-line">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="font-display text-2xl text-ink">How it works</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-3">
            <li className="rounded-sm bg-lavender p-5">
              <span className="font-display text-2xl text-postal-red">1</span>
              <div className="mt-2">
                <p className="font-medium text-ink">Set your price</p>
                <p className="mt-1 text-ink-soft">
                  Decide what a question is worth and how fast you&apos;ll
                  answer. Takes five minutes.
                </p>
              </div>
            </li>
            <li className="rounded-sm bg-lavender p-5">
              <span className="font-display text-2xl text-postal-red">2</span>
              <div className="mt-2">
                <p className="font-medium text-ink">Share your link</p>
                <p className="mt-1 text-ink-soft">
                  Drop it in your bio, newsletter, or wherever your audience
                  already finds you.
                </p>
              </div>
            </li>
            <li className="rounded-sm bg-lavender p-5">
              <span className="font-display text-2xl text-postal-red">3</span>
              <div className="mt-2">
                <p className="font-medium text-ink">Answer and get paid</p>
                <p className="mt-1 text-ink-soft">
                  Reply in your own words, on your own time. You keep most of
                  every payment.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Why this beats free DMs / beats AI — reframed for the expert's pitch to their audience */}
      <section className="border-t border-line bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="font-display text-2xl">
            Give your audience more than AI can
          </h2>
          <p className="mt-4 max-w-xl text-paper/80">
            Your audience can already ask AI anything for free. What they
            can&apos;t get from AI is you — your judgment, your experience,
            your name behind the answer. Drop Me A Question turns that into
            something you can actually charge for, without building a
            website or chasing invoices.
          </p>
        </div>
      </section>

      {/* Start CTA */}
      <section id="start" className="border-t border-line">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-2xl text-ink">
            Set up your page in five minutes
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink-soft">
            No website needed. No invoicing. Just a link you can share
            today.
          </p>
          
           <a href="#"
            className="mt-6 inline-block rounded-sm bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink"
          >
            Start Your Page
          </a>
        </div>
      </section>

      {/* Small, quiet redirect for the rare asker who lands here directly */}
      <section id="ask-instead" className="border-t border-line">
        <div className="mx-auto max-w-3xl px-6 py-10 text-center text-sm text-ink-soft">
          Have a link to a specific expert&apos;s page? Use that link
          directly to ask your question.
        </div>
      </section>

      <footer className="border-t border-line px-6 py-8 text-center text-sm text-ink-soft">
        © {new Date().getFullYear()} Drop Me A Question
      </footer>
    </main>
  );
}