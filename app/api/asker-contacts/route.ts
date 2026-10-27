import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'

// The only way an asker's email reaches an expert's browser: only for the
// signed-in expert's own questions, and only where the asker ticked "share my
// email" at checkout. Returns { [questionId]: email }. Before the opt-in
// columns exist this answers with an empty list.
export async function GET(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('questions')
    .select('id, asker_email')
    .eq('expert_id', user.id)
    .eq('share_email_with_expert', true)
    .in('status', ['pending', 'answered', 'declined', 'expired'])

  if (error) return NextResponse.json({ contacts: {} })

  const contacts: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.asker_email) contacts[row.id] = row.asker_email
  }
  return NextResponse.json({ contacts })
}
