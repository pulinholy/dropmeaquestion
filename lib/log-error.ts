import { supabaseAdmin } from './supabase-admin'

// Server-only error logger. Writes to the error_logs table so failures in
// webhooks, cron runs, and API routes -- places nobody is watching a
// terminal -- are actually discoverable afterward, not just lost in
// Vercel's function logs.
export async function logError(
  source: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  console.error(`[${source}]`, message)

  try {
    await supabaseAdmin.from('error_logs').insert({ source, message, stack, context })
  } catch (logErr) {
    console.error('Failed to write to error_logs:', logErr)
  }
}
