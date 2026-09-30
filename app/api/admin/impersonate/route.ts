import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/require-admin'
import { logError } from '@/lib/log-error'

export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { expertId } = await request.json()
  if (typeof expertId !== 'string') {
    return NextResponse.json({ error: 'Missing expertId' }, { status: 400 })
  }

  const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(expertId)
  if (userErr || !userRes.user?.email) {
    return NextResponse.json({ error: "Could not find that expert's account" }, { status: 404 })
  }

  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: userRes.user.email,
    options: {
      redirectTo: `${new URL(request.url).origin}/dashboard?impersonated=1`,
    },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    await logError('admin/impersonate', linkErr ?? new Error('No action_link returned'), {
      adminEmail: admin.email,
      targetExpertId: expertId,
    })
    return NextResponse.json(
      { error: linkErr?.message || 'Could not generate a login link' },
      { status: 500 }
    )
  }

  // Minimal audit trail -- who impersonated whom, when. Reuses error_logs
  // (the only durable log sink in this app) as a plain informational entry,
  // not an actual error -- source prefix makes that clear when browsing it.
  await supabaseAdmin.from('error_logs').insert({
    source: 'admin:impersonate',
    message: `Admin ${admin.email} logged in as expert ${userRes.user.email}`,
    context: { adminEmail: admin.email, targetExpertId: expertId, targetEmail: userRes.user.email },
  })

  return NextResponse.json({ actionLink: linkData.properties.action_link })
}
