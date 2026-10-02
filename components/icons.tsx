type IconProps = { className?: string }

// Full-color brand marks (for share buttons) -- unlike the rest of this
// file, these carry their own fixed fills/gradients rather than
// currentColor, so they read as recognizable platform badges.
export function LinkedInBadgeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <rect width="40" height="40" rx="9" fill="#0A66C2" />
      <rect x="9" y="16" width="5" height="15" fill="#fff" />
      <circle cx="11.5" cy="10.5" r="2.8" fill="#fff" />
      <path
        d="M18 16h5v2.3c1-1.7 2.9-2.7 5-2.7 4 0 6.5 2.6 6.5 7.4V31h-5v-7.2c0-2.1-.9-3.5-2.9-3.5-1.6 0-2.6 1.1-3 2.1-.2.4-.2 1-.2 1.6V31h-5V16z"
        fill="#fff"
      />
    </svg>
  )
}

export function InstagramBadgeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <defs>
        <linearGradient id="ig-badge-grad" x1="0" y1="40" x2="40" y2="0">
          <stop offset="0%" stopColor="#FEE411" />
          <stop offset="25%" stopColor="#FD5949" />
          <stop offset="55%" stopColor="#D6249F" />
          <stop offset="100%" stopColor="#285AEB" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9" fill="url(#ig-badge-grad)" />
      <rect
        x="10"
        y="10"
        width="20"
        height="20"
        rx="6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
      />
      <circle cx="20" cy="20" r="5.2" fill="none" stroke="#fff" strokeWidth="2.2" />
      <circle cx="26.5" cy="13.5" r="1.4" fill="#fff" />
    </svg>
  )
}

export function YouTubeBadgeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <rect width="40" height="40" rx="9" fill="#FF0000" />
      <polygon points="16,13 29,20 16,27" fill="#fff" />
    </svg>
  )
}

export function TikTokBadgeIcon({ className }: IconProps) {
  const notePath =
    "M24.8 11.5c.7 2.2 2.3 3.8 4.7 4v3.3c-1.7.1-3.2-.4-4.7-1.3v6.9c0 4-3.2 6.9-6.9 6.9-1.5 0-2.9-.5-4-1.3 3.6.5 6.6-2.3 6.6-5.8v-.2 -12.5h4.3z"
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <rect width="40" height="40" rx="9" fill="#000" />
      <path d={notePath} fill="#25F4EE" transform="translate(-0.6,-0.6)" />
      <path d={notePath} fill="#FE2C55" transform="translate(0.6,0.6)" />
      <path d={notePath} fill="#fff" />
    </svg>
  )
}

export function FacebookBadgeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <circle cx="20" cy="20" r="20" fill="#1877F2" />
      <path
        d="M23.5 20.5h-3V31h-4.4V20.5h-2.1v-3.7h2.1v-2.4c0-3 1.3-4.9 4.9-4.9h3v3.7h-1.9c-1.4 0-1.5.5-1.5 1.5v2.1h3.4l-.5 3.7z"
        fill="#fff"
      />
    </svg>
  )
}

export function XBadgeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" className={className}>
      <rect width="40" height="40" rx="9" fill="#000" />
      <path
        d="M11 11l7.3 9.1L11 29h2.6l6.1-7 4.8 7h5.3l-7.6-9.7L28.9 11h-2.6l-5.7 6.6L16.3 11H11z"
        fill="#fff"
      />
    </svg>
  )
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

// Solid speech-bubble mark with three dots -- same shape as the orange "Q"
// bubble in the DMQ logo, for use anywhere that mark should be echoed
// without the navy ring around it.
export function ChatBubbleMarkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 10.2C4 6.2 7.6 3 12 3s8 3.2 8 7.2-3.6 7.2-8 7.2c-.8 0-1.6-.1-2.3-.3L5.2 20l1-4C4.8 14.7 4 12.6 4 10.2z"
        fill="currentColor"
      />
      <circle cx="8.5" cy="10.2" r="1.3" fill="#fff" />
      <circle cx="12" cy="10.2" r="1.3" fill="#fff" />
      <circle cx="15.5" cy="10.2" r="1.3" fill="#fff" />
    </svg>
  )
}

export function LightningIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function ShieldCheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  )
}

export function TagIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12.6 2H6a2 2 0 0 0-2 2v6.6a2 2 0 0 0 .6 1.4l9 9a2 2 0 0 0 2.8 0l6.6-6.6a2 2 0 0 0 0-2.8l-9-9a2 2 0 0 0-1.4-.6Z" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 17H7a5 5 0 0 1 0-10h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

export function RobotIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="8" width="16" height="10" rx="2" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
      <path d="M2 12h2M20 12h2" />
    </svg>
  )
}

export function PersonIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}

export function BriefcaseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  )
}

export function PaletteIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h2.3c1.8 0 3.2-1.4 3.2-3.2C21 6.6 17 2 12 2Z" />
      <circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function RocketIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2c2.5 2 4 5.5 4 9 0 2-1 4-2 5l-2 2-2-2c-1-1-2-3-2-5 0-3.5 1.5-7 4-9Z" />
      <circle cx="12" cy="9" r="1.4" fill="currentColor" stroke="none" />
      <path d="M9 16l-2.5 2.5M15 16l2.5 2.5" />
    </svg>
  )
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

export function UploadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 20V9" />
      <path d="m7 13 5-5 5 5" />
      <path d="M5 5h14" />
    </svg>
  )
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v11" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 19h14" />
    </svg>
  )
}

export function ImageIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none" />
      <path d="m4 17 5-5 4 4 3-3 4 4" />
    </svg>
  )
}

export function LightbulbIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.44 1 .96 1.1 1.6h4.8c.1-.64.5-1.16 1.1-1.6A6 6 0 0 0 12 3Z" />
    </svg>
  )
}

export function CodeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <polyline points="8 6 3 12 8 18" />
      <polyline points="16 6 21 12 16 18" />
    </svg>
  )
}

export function MegaphoneIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 9v6h4l7 5V4L7 9H3Z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </svg>
  )
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="9" r="3" />
      <path d="M3 21c0-3.9 2.7-7 6-7s6 3.1 6 7" />
      <path d="M16 8a2.2 2.2 0 1 0 0-4.4" />
      <path d="M16.5 14c2 .5 3.5 2.8 3.5 5.5" />
    </svg>
  )
}

export function BarChartIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <line x1="5" y1="20" x2="5" y2="13" />
      <line x1="11" y1="20" x2="11" y2="6" />
      <line x1="17" y1="20" x2="17" y2="10" />
    </svg>
  )
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <polygon points="12 2.5 14.9 8.6 21.5 9.4 16.7 13.8 18 20.4 12 17.1 6 20.4 7.3 13.8 2.5 9.4 9.1 8.6" />
    </svg>
  )
}

export function ListIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
      <line x1="9" y1="6" x2="21" y2="6" />
      <line x1="9" y1="12" x2="21" y2="12" />
      <line x1="9" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

export function QrCodeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <line x1="14" y1="14" x2="14" y2="17" />
      <line x1="17" y1="14" x2="21" y2="14" />
      <line x1="14" y1="20" x2="14" y2="20.01" />
      <line x1="17" y1="17" x2="17" y2="20" />
      <line x1="20" y1="17" x2="21" y2="17" />
      <line x1="20" y1="20" x2="21" y2="20" />
    </svg>
  )
}

export function PaperclipIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M21.4 11.1 12.3 20.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.9l8.5-8.4" />
    </svg>
  )
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

// A small fan of radiating dashes, used as a light decorative accent
// (not a labeled annotation) next to illustrative UI mockups.
// Outlined four-point star pair -- the "sparkle" used on the example-profile banner.
export function SparkleIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 3c.5 4.4 2.3 6.700 6.500 7.500-4.200.8-6 3.100-6.500 7.500-.5-4.400-2.300-6.700-6.500-7.500C7.700 9.700 9.500 7.400 10 3z" />
      <path d="M18.500 14c.2 1.700.9 2.600 2.500 2.800-1.600.2-2.300 1.100-2.500 2.800-.2-1.700-.9-2.600-2.500-2.800 1.600-.2 2.300-1.100 2.500-2.800z" />
    </svg>
  )
}

export function SparkleAccentIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
    >
      <line x1="12" y1="1" x2="12" y2="8" />
      <line x1="3" y1="5" x2="8" y2="10" />
      <line x1="21" y1="5" x2="16" y2="10" />
    </svg>
  )
}

export function XIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <line x1="4" y1="4" x2="20" y2="20" />
      <line x1="20" y1="4" x2="4" y2="20" />
    </svg>
  )
}

export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="7.5" y1="10.5" x2="7.5" y2="17" />
      <circle cx="7.5" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
      <path d="M11.5 17v-4a2 2 0 0 1 4 0v4" />
      <line x1="11.5" y1="17" x2="11.5" y2="10.5" />
    </svg>
  )
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function DollarSignIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 6.5c0-1.9-2.2-3-5-3s-5 1.4-5 3.5 2.2 3 5 3.5 5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.1-5-3" />
    </svg>
  )
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9.9 4.6A10.4 10.4 0 0 1 12 4.4c6.5 0 10.5 7 10.5 7a17.3 17.3 0 0 1-3.1 4" />
      <path d="M6.6 6.6C3.4 8.6 1.5 12 1.5 12s4 7 10.5 7a10.4 10.4 0 0 0 4.4-1" />
      <path d="M9.5 9.7a3 3 0 0 0 4.2 4.2" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h5v-6h4v6h5V10" />
    </svg>
  )
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="18" r="2" />
    </svg>
  )
}

export function CreditCardIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <polyline points="4 12 9 17 20 6" />
    </svg>
  )
}

export function TargetIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function YouTubeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <polygon
        points="10 9 16 12 10 15"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

export function TikTokIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15 3v10.8a3.7 3.7 0 1 1-3.7-3.7" />
      <path d="M15 3a4.7 4.7 0 0 0 4.7 4.7" />
    </svg>
  )
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14 8.5h-1.3a1.8 1.8 0 0 0-1.8 1.8V12" />
      <path d="M9 12h4.5" />
      <line x1="10.9" y1="12" x2="10.9" y2="18" />
    </svg>
  )
}
