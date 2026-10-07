import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import { logError } from './log-error'

export type RateLimitRule = {
  // Also the bucket name -- keep it unique per limit.
  name: string
  limit: number
  windowSeconds: number
  // Who is being counted. Defaults to the caller's IP; pass a user id for
  // signed-in callers, or a fixed string such as "global" for a shared cap.
  subject?: string
}

// Vercel sets these from the real connection and overwrites any client-sent
// value, so the first forwarded address can be trusted there.
function callerIp(request: Request): string {
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}

// Stored hashed so the table never holds raw visitor IP addresses.
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 24)
}

function waitMessage(retryAfter: number): string {
  if (retryAfter < 60) return `${retryAfter} second${retryAfter === 1 ? '' : 's'}`
  const minutes = Math.ceil(retryAfter / 60)
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

let loggedBackendFailure = false

// Counts one hit against each rule in order. Returns a ready-made 429 response
// for the first rule that is over its limit, or null if the request may
// proceed. If the counter itself is unreachable it lets the request through:
// a broken limiter should never lock real users out.
export async function enforceRateLimit(
  request: Request,
  rules: RateLimitRule[]
): Promise<NextResponse | null> {
  const ipHash = hashIp(callerIp(request))

  for (const rule of rules) {
    const key = `${rule.name}:${rule.subject ?? ipHash}`

    try {
      const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
        p_key: key,
        p_window_seconds: rule.windowSeconds,
        p_limit: rule.limit,
      })

      if (error) throw error

      const row = Array.isArray(data) ? data[0] : data
      if (!row || typeof row.allowed !== 'boolean') {
        throw new Error('Unexpected rate_limit_hit response')
      }

      if (!row.allowed) {
        const retryAfter = Number(row.retry_after) || rule.windowSeconds
        return NextResponse.json(
          {
            error: `Too many requests. Please try again in ${waitMessage(retryAfter)}.`,
          },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    } catch (err) {
      // Once per server instance, so a missing table can't flood error_logs.
      if (!loggedBackendFailure) {
        loggedBackendFailure = true
        await logError('rate-limit', err, { rule: rule.name })
      }
    }
  }

  return null
}
