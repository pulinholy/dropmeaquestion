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
          DropMeAQuestion
        </span>
        
         <a href="#expert"
          className="text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
        >
          Become an expert
        </a>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-20">
        <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
           Drop a real question to a real expert.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-soft">
          One question. One accountable, personal answer from someone who has
          actually been there — no account needed, no browsing a crowd of
          strangers.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          
           <a href="#ask"
            className="rounded-sm bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-postal-blue"
          >
            Drop a Question
          </a>
          
           <a href="#expert"
            className="text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
          >
            Register as an expert
          </a>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="font-display text-2xl text-ink">How it works</h2>
          <ol className="mt-8 space-y-8">
            <li className="flex gap-5">
              <span className="font-display text-2xl text-postal-red">1</span>
              <div>
                <p className="font-medium text-ink">Find the person you trust</p>
                <p className="mt-1 text-ink-soft">
                  Follow a link an expert shared on their site, newsletter, or
                  bio.
                </p>
              </div>
            </li>
            <li className="flex gap-5">
              <span className="font-display text-2xl text-postal-red">2</span>
              <div>
                <p className="font-medium text-ink">Drop your question</p>
                <p className="mt-1 text-ink-soft">
                  Pay a small fee and write exactly what you want answered —
                  paste what AI told you, if that&apos;s where you started.
                </p>
              </div>
            </li>
            <li className="flex gap-5">
              <span className="font-display text-2xl text-postal-red">3</span>
              <div>
                <p className="font-medium text-ink">Get a real answer</p>
                <p className="mt-1 text-ink-soft">
                  A personal reply within the expert&apos;s stated window — or
                  an automatic refund if they miss it.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="border-t border-line bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="font-display text-2xl">Why not just ask AI?</h2>
          <p className="mt-4 max-w-xl text-paper/80">
            AI is a good place to start. But it can&apos;t vouch for you,
            hasn&apos;t lived your specific situation, and won&apos;t put its
            name behind the answer. DropMeAQuestion connects you with someone
            who will — a real person, accountable for what they tell you.
          </p>
        </div>
      </section>

      <section id="expert" className="border-t border-line">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-2xl text-ink">
            Already answering questions for free?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink-soft">
            Set up your profile in five minutes and get paid for the
            expertise people already ask you for.
          </p>
          
            <a href="#"
            className="mt-6 inline-block rounded-sm bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink"
          >
            Register as an Expert
          </a>
        </div>
      </section>

      <footer className="border-t border-line px-6 py-8 text-center text-sm text-ink-soft">
        © {new Date().getFullYear()} DropMeAQuestion
      </footer>
    </main>
  );
}