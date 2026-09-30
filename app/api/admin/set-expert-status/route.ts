import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'
import { logError } from '@/lib/log-error'

// "Deactivated" is deliberately separate from the expert's own "paused"
// toggle: pausing is self-service and reversible, still shows the full
// profile with a friendly "not accepting questions" message. Deactivating
// is admin-only, hides the profile entirely, and blocks login outright --
// for abuse/ToS situations, not routine availability.
const PERMANENT_BAN = '876000h' // ~100 years

export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { expertId, deactivate } = await request.json()

  if (typeof expertId !== 'string' || typeof deactivate !== 'boolean') {
    return NextResponse.json({ error: 'Missing expertId or deactivate' }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('experts')
    .update({ deactivated_at: deactivate ? new Date().toISOString() : null })
    .eq('id', expertId)

  if (updateError) {
    await logError('admin/set-expert-status:db', updateError, { expertId, deactivate, adminEmail: admin.email })
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(expertId, {
    ban_duration: deactivate ? PERMANENT_BAN : 'none',
  })

  if (banError) {
    await logError('admin/set-expert-status:auth', banError, { expertId, deactivate, adminEmail: admin.email })
    return NextResponse.json({ error: banError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
