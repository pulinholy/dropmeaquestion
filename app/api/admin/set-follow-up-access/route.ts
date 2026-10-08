import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'
import { logError } from '@/lib/log-error'

// Private beta: switches follow-up conversations on or off for one expert.
// Turning access off hides the setting and stops new offers; conversations
// already booked carry on as normal.
export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  let body: { expertId?: unknown; allowed?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.expertId !== 'string' || typeof body.allowed !== 'boolean') {
    return NextResponse.json({ error: 'Missing expertId or allowed' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('experts')
    .update({ follow_up_allowed: body.allowed })
    .eq('id', body.expertId)
    .select('id')

  if (error) {
    await logError('admin/set-follow-up-access', error, {
      expertId: body.expertId,
      allowed: body.allowed,
      adminEmail: admin.email,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Expert not found.' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
