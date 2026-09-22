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
        <a href="/" className="flex items-center">
          <img
            src="/brand/logo-lockup.png"
            alt="Drop Me A Question"
            className="h-8 w-auto sm:h-9"
          />
        </a>

        <nav className="flex flex-wrap items-center gap-4 sm:gap-6">
          <a
            href="#how"
            className="hidden text-sm text-ink-soft hover:text-ink sm:inline"
          >
            How it works
          </a>
          <a href="/login" className="text-sm text-ink-soft hover:text-ink">
            Log in
          </a>
          <a
            href="/register"
            className="rounded-full bg-postal-red px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink"
          >
            Create page
          </a>
        </nav>
      </header>

      {/* Hero — written for the expert */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-20 text-center">
        <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
          People have questions.
          <br />
          You have answers.
        </h1>
        <p className="mt-3 font-display text-2xl font-medium text-postal-red sm:text-3xl">
          Now you can get paid for them.
        </p>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft">
          Set your price. Share one link. Answer within the time you set.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="/register"
            className="rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-postal-blue"
          >
            Create your page →
          </a>
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          No website. No invoices. Just your expertise.
        </p>
      </section>

      {/* Example page preview — illustrative only, not a real expert */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="text-sm font-medium text-ink-soft">
            What your page could look like
          </p>
          <div className="mt-6 rounded-sm border border-line bg-lavender p-8">
            <p className="font-display text-xl italic text-ink">
              &ldquo;Ask me anything about building startups.&rdquo;
            </p>
            <div className="mx-auto mt-6 h-16 w-16 rounded-full bg-paper" />
            <p className="mt-4 font-display text-lg text-ink">
              Sarah Johnson
            </p>
            <p className="text-sm text-ink-soft">Startup advisor</p>
            <p className="mt-3 text-sm text-ink-soft">
              $25 · 48 hour response
            </p>
            <a
              href="/register"
              className="mt-6 inline-block rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink"
            >
              Drop me a question →
            </a>
          </div>
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
                  Reply in your own words, within the time you set. You keep
                  most of every payment.
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
            AI has answers. You have experience.
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

      {/* Who this is for */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="font-display text-2xl text-ink">Who is this for?</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 text-ink sm:grid-cols-3">
            <p>Consultants</p>
            <p>Creators</p>
            <p>Coaches</p>
            <p>Designers</p>
            <p>Developers</p>
            <p>Advisors</p>
            <p>Lawyers*</p>
            <p>Marketers</p>
            <p>Experts</p>
          </div>
          <p className="mt-6 text-sm text-ink-soft">
            * Check that paid Q&amp;A fits your profession&apos;s licensing
            rules before you start.
          </p>
        </div>
      </section>

      {/* Start CTA */}
      <section id="start" className="border-t border-line">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-2xl text-ink">
            Your knowledge shouldn&apos;t have to live in your DMs.
          </h2>
          <a
            href="/register"
            className="mt-6 inline-block rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink"
          >
            Create your page →
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
        <a href="/terms" className="hover:text-ink">
          Terms of Service
        </a>
        <span className="mx-2">·</span>
        © {new Date().getFullYear()} Drop Me A Question
      </footer>
    </main>
  );
}
