import { NextResponse } from 'next/server'

// Temporary diagnostic route -- NEXT_PUBLIC_SUPABASE_URL is not sensitive
// (it's shipped to every browser anyway), safe to expose for one check.
export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    vercelEnv: process.env.VERCEL_ENV,
  })
}
