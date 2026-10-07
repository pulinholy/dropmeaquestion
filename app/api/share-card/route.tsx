import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'
import { PUBLIC_SITE_URL } from '@/lib/site'
import {
  fetchAvatarDataUrl,
  renderShareCard,
  type ShareCardStyle,
} from '@/lib/share-card'

export const runtime = 'nodejs'

// Renders the signed-in expert's own share card. Everything shown on the card
// comes from the database -- the request only picks a style and one of their
// own topics -- so nobody can mint a card for someone else or make the server
// fetch an arbitrary address.
export async function GET(request: Request) {
  const user = await requireUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, [
    { name: 'share-card', subject: user.id, limit: 120, windowSeconds: 3600 },
  ])
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const style: ShareCardStyle = searchParams.get('style') === 'topic' ? 'topic' : 'profile'
  const requestedTopic = searchParams.get('topic')

  const [{ data: profile }, { data: expert }, { data: topicRows }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('full_name, username, avatar_url')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseAdmin.from('experts').select('headline').eq('id', user.id).maybeSingle(),
    supabaseAdmin
      .from('expert_topics')
      .select('name')
      .eq('expert_id', user.id)
      .order('sort_order', { ascending: true }),
  ])

  if (!profile || !expert) {
    return NextResponse.json({ error: 'Set up your page first.' }, { status: 404 })
  }

  const topics = (topicRows ?? []).map((t) => t.name as string)
  // Only one of the expert's own topics may be highlighted.
  const highlightTopic =
    requestedTopic && topics.includes(requestedTopic)
      ? requestedTopic
      : style === 'topic'
        ? (topics[0] ?? null)
        : null

  try {
    return await renderShareCard({
      style,
      name: (profile.full_name ?? '').slice(0, 60) || 'Your Name',
      headline: (expert.headline ?? '').slice(0, 80),
      topics,
      highlightTopic,
      avatarDataUrl: await fetchAvatarDataUrl(profile.avatar_url),
      displayUrl: `${PUBLIC_SITE_URL.replace(/^https?:\/\/(www\.)?/, '')}/${profile.username}`,
    })
  } catch (err) {
    await logError('share-card', err, { userId: user.id })
    return NextResponse.json({ error: 'Could not create your card right now.' }, { status: 500 })
  }
}
