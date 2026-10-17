import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'
import { GUIDANCE_MAX, STARTER_MAX, checkQuestionFormText } from '@/lib/question-form'

// Saves the signed-in expert's question-form text. The length and the "no
// links, emails or phone numbers" rule are checked here as well as on the page.
export async function POST(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'save-question-form', subject: user.id, limit: 60, windowSeconds: 3600 },
  ])
  if (limited) return limited

  let body: { guidance?: unknown; starter?: unknown; enabled?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const guidance = checkQuestionFormText(
    typeof body.guidance === 'string' ? body.guidance : '',
    GUIDANCE_MAX,
    'What to include'
  )
  if (!guidance.ok) return NextResponse.json({ error: guidance.message }, { status: 400 })

  const starter = checkQuestionFormText(
    typeof body.starter === 'string' ? body.starter : '',
    STARTER_MAX,
    'Starter text'
  )
  if (!starter.ok) return NextResponse.json({ error: starter.message }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('experts')
    .update({
      question_guidance: guidance.text || null,
      question_template: starter.text || null,
    })
    .eq('id', user.id)
  if (error) {
    await logError('save-question-form', error, { expertId: user.id })
    return NextResponse.json(
      { error: 'Could not save yet. Please try again in a moment.' },
      { status: 500 }
    )
  }

  // The on/off switch is a separate write, so saving still works before the
  // database has that column.
  if (typeof body.enabled === 'boolean') {
    await supabaseAdmin
      .from('experts')
      .update({ question_form_enabled: body.enabled })
      .eq('id', user.id)
  }

  return NextResponse.json({ success: true })
}
