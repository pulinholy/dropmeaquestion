export default function SiteFooter({
  variant = "default",
}: {
  // "asker" adds a "Powered by" lockup, for pages a paying asker lands on
  // (an expert's page) where the platform isn't otherwise obvious.
  variant?: "default" | "asker"
}) {
  return (
    <footer className="border-t border-line px-6 py-8 text-center text-sm text-ink-soft">
      {variant === "asker" ? (
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-ink-soft/70 hover:text-ink"
        >
          Powered by
          <img
            src="/brand/logo-lockup.png"
            alt="Drop Me A Question"
            className="h-4 w-auto"
          />
        </a>
      ) : (
        <a href="/" className="inline-flex items-center">
          <img
            src="/brand/logo-icon.png"
            alt="Drop Me A Question"
            className="mx-auto h-6 w-auto opacity-70"
          />
        </a>
      )}
      <p className="mt-4">
        <a href="/terms" className="hover:text-ink">
          Terms of Service
        </a>
        <span className="mx-2">·</span>
        <a href="/privacy" className="hover:text-ink">
          Privacy Policy
        </a>
        <span className="mx-2">·</span>
        © {new Date().getFullYear()} Drop Me A Question
      </p>
    </footer>
  )
}
