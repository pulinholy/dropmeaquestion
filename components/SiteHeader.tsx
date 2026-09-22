export default function SiteHeader() {
  return (
    <>
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
        </nav>
      </header>
    </>
  )
}
