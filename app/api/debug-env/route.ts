import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Temporary diagnostic route -- NEXT_PUBLIC_SUPABASE_URL is not sensitive
// (it's shipped to every browser anyway), safe to expose for one check.
export async function GET() {
  const anonResult = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', 'vipin')
    .maybeSingle()

  const adminResult = await supabaseAdmin
    .from('profiles')
    .select('id, username')
    .eq('username', 'vipin')
    .maybeSingle()

  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    vercelEnv: process.env.VERCEL_ENV,
    anonKeyQuery: { data: anonResult.data, error: anonResult.error?.message ?? null },
    serviceRoleQuery: { data: adminResult.data, error: adminResult.error?.message ?? null },
  })
}
