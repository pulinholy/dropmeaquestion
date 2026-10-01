import { supabaseAdmin } from './supabase-admin'

// Re-derives the caller's identity from their own access token server-side
// -- never trust a client-supplied id for authorization. Returns the auth
// user if the token is valid, or null.
export async function requireUser(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null

  return data.user
}
