// The publicly reachable site URL. Needed anywhere a URL must resolve
// outside the browser/process that generated it -- link previews, crawlers,
// and email clients -- so it stays the real domain even when
// NEXT_PUBLIC_SITE_URL is pointed at localhost for local dev checkout
// redirects.
export const PUBLIC_SITE_URL = process.env.EMAIL_BASE_URL || 'https://www.dropmeaquestion.com'
