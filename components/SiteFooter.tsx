import { YouTubeIcon, LinkedInIcon, InstagramIcon } from "./icons"

const socialLinks = [
  {
    label: "YouTube",
    href: "https://www.youtube.com/@Dropmeaquestion",
    icon: YouTubeIcon,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/dropmeaquestion",
    icon: LinkedInIcon,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/dropmeaquestion",
    icon: InstagramIcon,
  },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-line px-6 py-6 text-sm text-ink-soft">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-ink-soft/80">
          <a href="/" className="flex items-center">
            <img
              src="/brand/logo-icon.png"
              alt="Drop Me A Question"
              className="h-5 w-auto opacity-70"
            />
          </a>
          <span>© {new Date().getFullYear()} Drop Me A Question</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <a href="/terms" className="hover:text-ink">
            Terms
          </a>
          <span aria-hidden className="text-line">
            ·
          </span>
          <a href="/privacy" className="hover:text-ink">
            Privacy
          </a>
          <span aria-hidden className="text-line">
            ·
          </span>
          <a
            href="mailto:hello@dropmeaquestion.com"
            className="hover:text-ink"
          >
            Contact
          </a>
        </div>

        <div className="flex items-center gap-4">
          {socialLinks.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className="text-ink-soft hover:text-ink"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
