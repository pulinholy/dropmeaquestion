import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resend } from '@/lib/resend'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: overdue, error: fetchError } = await supabaseAdmin
    .from('questions')
    .select('id, expert_id, asker_email, question_text, stripe_payment_intent_id')
    .eq('status', 'pending')
    .lt('deadline_at', new Date().toISOString())

  if (fetchError) {
    console.error('Failed to fetch overdue questions:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const results = []

  for (const question of overdue ?? []) {
    try {
      // Claim the row first, and only if it's still pending — guards against a
      // race with the expert answering/declining it at the same moment.
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from('questions')
        .update({ status: 'expired' })
        .eq('id', question.id)
        .eq('status', 'pending')
        .select('id')

      if (claimError) throw claimError

      if (!claimed || claimed.length === 0) {
        results.push({ id: question.id, status: 'skipped' })
        continue
      }

      if (question.stripe_payment_intent_id) {
        await stripe.paymentIntents.cancel(question.stripe_payment_intent_id)
      }

      const { data: expert } = await supabaseAdmin
        .from('experts')
        .select('id, headline')
        .eq('id', question.expert_id)
        .maybeSingle()

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', question.expert_id)
        .maybeSingle()

      const expertName = profile?.full_name ?? expert?.headline ?? 'The expert'
      const expertFirstName = expertName.split(' ')[0]

      const { error: emailError } = await resend.emails.send({
        from: 'Drop Me A Question <hello@dropmeaquestion.com>',
        to: question.asker_email,
        subject: `Your question to ${expertFirstName} has expired`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <p>${expertFirstName} didn't answer your question in time, so it's expired:</p>
            <blockquote style="border-left: 3px solid #ddd; margin: 16px 0; padding-left: 12px; color: #555;">
              ${question.question_text}
            </blockquote>
            <p>No worries — your card was never charged. The payment hold has been released.</p>
            <p style="margin-top: 32px; font-size: 13px; color: #888;">Sent via Drop Me A Question</p>
          </div>
        `,
      })

      if (emailError) {
        console.error(`Failed to send expiry email for question ${question.id}:`, emailError)
      }

      results.push({ id: question.id, status: 'expired' })
    } catch (err) {
      console.error(`Failed to expire question ${question.id}:`, err)
      results.push({ id: question.id, status: 'error', message: (err as Error).message })
    }
  }

  return NextResponse.json({ checked: overdue?.length ?? 0, results })
}
