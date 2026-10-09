import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enforceRateLimit } from '@/lib/rate-limit'

// Lets the asker's "processing your request" page find out whether their
// booking went through, without waiting for an email. The question id in
// their link is the unguessable key (as on the booking page itself), and
// only a coarse state comes back: still waiting, sent, or not booked.
export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, [
    { name: 'follow-up-status', limit: 120, windowSeconds: 60 },
  ])
  if (limited) return limited

  const questionId = new URL(request.url).searchParams.get('questionId')
  if (!questionId) {
    return NextResponse.json({ error: 'Missing questionId' }, { status: 400 })
  }

  const { data: call, error } = await supabaseAdmin
    .from('follow_up_calls')
    .select('status, released_at')
    .eq('question_id', questionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: 'Could not check.' }, { status: 500 })
  }

  // No booking yet, or the card hold hasn't been confirmed: keep waiting.
  if (!call || call.status === 'awaiting_payment') {
    return NextResponse.json({ state: 'pending' })
  }

  // Ended without ever reaching the expert, and the hold was let go.
  if (call.status === 'expired' && call.released_at) {
    return NextResponse.json({ state: 'not_booked' })
  }

  return NextResponse.json({ state: 'sent' })
}
