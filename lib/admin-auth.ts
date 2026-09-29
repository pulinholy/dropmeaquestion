// Admins are just an email allowlist, not a DB flag -- only someone with
// access to Vercel's env vars can grant admin access, so it can't be
// escalated by mutating app data.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}
