export default function SiteFooter() {
  return (
    <footer className="border-t border-line px-6 py-8 text-center text-sm text-ink-soft">
      <a href="/terms" className="hover:text-ink">
        Terms of Service
      </a>
      <span className="mx-2">·</span>
      <a href="/privacy" className="hover:text-ink">
        Privacy Policy
      </a>
      <span className="mx-2">·</span>
      © {new Date().getFullYear()} Drop Me A Question
    </footer>
  )
}
