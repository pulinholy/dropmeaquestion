import { supabaseAdmin } from './supabase-admin'
import { defaultSignature, normalizeSignature, type AnswerSignature } from './answer-signature'

// What the PDF and the answer email need to know about the expert, in one
// place so the preview, the download and the email always agree.
export async function loadExpertLetterInfo(expertId: string): Promise<{
  fullName: string
  headline: string
  signature: AnswerSignature
}> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', expertId)
    .maybeSingle()
  const { data: expert } = await supabaseAdmin
    .from('experts')
    .select('headline')
    .eq('id', expertId)
    .maybeSingle()

  const fullName = profile?.full_name || 'Your expert'
  const headline = expert?.headline ?? ''
  const fallback = defaultSignature(fullName, headline)

  // Read separately so everything keeps working before the database has the
  // signature column: an error here just means the default signature.
  const { data: saved } = await supabaseAdmin
    .from('experts')
    .select('answer_signature')
    .eq('id', expertId)
    .maybeSingle()

  return {
    fullName,
    headline,
    signature: normalizeSignature(saved?.answer_signature, fallback),
  }
}
