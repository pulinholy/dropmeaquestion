export default function SiteHeader({
  variant = "default",
}: {
  // "default" is for expert-facing pages (home, register, login, etc).
  // "asker" is for pages an asker lands on (an expert's page, thank-you) —
  // they have no account and don't need the expert-focused nav.
  variant?: "default" | "asker"
}) {
  return (
    <>
      <div className="h-1 w-full bg-postal-red" />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between border-b border-line px-6 py-6">
        <a href="/" className="flex items-center">
          <img
            src="/brand/logo-icon.png"
            alt="Drop Me A Question"
            className="h-8 w-auto sm:hidden"
          />
          <img
            src="/brand/logo-lockup.png"
            alt="Drop Me A Question"
            className="hidden h-8 w-auto sm:block sm:h-9"
          />
        </a>

        <nav className="flex flex-wrap items-center gap-4 sm:gap-6">
          {variant === "default" && (
            <>
              <a
                href="/#how"
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
            </>
          )}

          {variant === "asker" && (
            <a
              href="/register"
              className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
            >
              Create your own page <span aria-hidden>→</span>
            </a>
          )}
        </nav>
      </header>
    </>
  )
}
