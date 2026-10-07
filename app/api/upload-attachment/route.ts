import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'
import { enforceRateLimit } from '@/lib/rate-limit'

const MAX_SIZE = 4 * 1024 * 1024

function sniffFileType(bytes: Uint8Array): { ext: string; mimeType: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', mimeType: 'image/jpeg' }
  }
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) {
    return { ext: 'png', mimeType: 'image/png' }
  }
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { ext: 'webp', mimeType: 'image/webp' }
  }
  if (
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
  ) {
    return { ext: 'pdf', mimeType: 'application/pdf' }
  }
  return null
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, [
    { name: 'upload-attachment', limit: 20, windowSeconds: 3600 },
  ])
  if (limited) return limited

  let sessionIdForLogging: string | null = null

  try {
    const formData = await request.formData()
    const sessionId = formData.get('sessionId')
    sessionIdForLogging = typeof sessionId === 'string' ? sessionId : null
    const file = formData.get('file')

    if (typeof sessionId !== 'string' || !sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File must be 4MB or smaller' }, { status: 400 })
    }

    // Re-derive the question from Stripe's own checkout session id,
    // server-side — never trust a client-supplied question id directly, so
    // a stranger can't overwrite someone else's attachment. The session id
    // is Stripe-generated and unguessable, and is resolved against our own
    // database rather than calling Stripe's API.
    const { data: question } = await supabaseAdmin
      .from('questions')
      .select('id, expert_id, status')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()

    if (!question) {
      return NextResponse.json({ error: 'Question not found for this session' }, { status: 404 })
    }

    if (question.status === 'awaiting_payment') {
      return NextResponse.json(
        { error: 'Payment has not been confirmed for this question yet.' },
        { status: 400 }
      )
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const sniffed = sniffFileType(bytes)

    if (!sniffed) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP, or PDF files are allowed' },
        { status: 400 }
      )
    }

    const path = `${question.expert_id}/${question.id}.${sniffed.ext}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('question-attachments')
      .upload(path, bytes, { upsert: true, contentType: sniffed.mimeType })

    if (uploadError) {
      await logError('upload-attachment:storage', uploadError, { questionId: question.id })
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('questions')
      .update({ attachment_path: path })
      .eq('id', question.id)

    if (updateError) {
      await logError('upload-attachment:db', updateError, { questionId: question.id })
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    await logError('upload-attachment', err, { sessionId: sessionIdForLogging })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
