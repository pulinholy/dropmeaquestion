import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'
import { checkSignatureInput } from '@/lib/answer-signature'

// Saves the signed-in expert's answer signature. The fields are checked and
// cleaned here as well as on the page, and only plain text is ever stored.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'save-signature', subject: user.id, limit: 60, windowSeconds: 3600 },
  ])
  if (limited) return limited

  let body: { signature?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const checked = checkSignatureInput(body.signature)
  if (!checked.ok) return NextResponse.json({ error: checked.message }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('experts')
    .update({ answer_signature: checked.signature })
    .eq('id', user.id)
  if (error) {
    await logError('save-signature', error, { expertId: user.id })
    return NextResponse.json(
      { error: 'Could not save your signature yet. Please try again in a moment.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
