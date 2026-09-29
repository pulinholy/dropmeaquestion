import { supabaseAdmin } from './supabase-admin'
import { isAdminEmail } from './admin-auth'

// Re-derives the caller's identity from their own access token server-side
// -- never trust a client-supplied email or role. Returns the auth user if
// they're both a valid, logged-in user and on the admin allowlist.
export async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user || !isAdminEmail(data.user.email)) return null

  return data.user
}
