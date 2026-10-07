// The publicly reachable site URL. Needed anywhere a URL must resolve
// outside the browser/process that generated it -- link previews, crawlers,
// and email clients -- so it stays the real domain even when
// NEXT_PUBLIC_SITE_URL is pointed at localhost for local dev checkout
// redirects.
export const PUBLIC_SITE_URL = process.env.EMAIL_BASE_URL || 'https://www.dropmeaquestion.com'

// Where Stripe sends people back to after checkout and onboarding. Follows
// NEXT_PUBLIC_SITE_URL so local dev returns to localhost, but falls back to
// the real domain if it's ever unset -- otherwise Stripe is handed
// "undefined/thank-you?..." and the redirect breaks.
export const APP_BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || PUBLIC_SITE_URL
).replace(/\/+$/, '')
