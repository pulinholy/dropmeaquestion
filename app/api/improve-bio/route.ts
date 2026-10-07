import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { logError } from '@/lib/log-error'
import { enforceRateLimit } from '@/lib/rate-limit'

const MAX_BIO_LENGTH = 500
const MIN_INPUT_LENGTH = 10
const MAX_INPUT_LENGTH = 2000

export async function POST(request: Request) {
  // Every call here costs money and the route is open to anyone (it's used
  // during sign-up), so cap each visitor and the whole site.
  const limited = await enforceRateLimit(request, [
    { name: 'improve-bio', limit: 10, windowSeconds: 3600 },
    { name: 'improve-bio-global', subject: 'global', limit: 200, windowSeconds: 3600 },
  ])
  if (limited) return limited

  const { bio } = await request.json()

  if (typeof bio !== 'string' || bio.trim().length < MIN_INPUT_LENGTH) {
    return NextResponse.json(
      { error: 'Write a bit more before improving it with AI.' },
      { status: 400 }
    )
  }

  if (bio.length > MAX_INPUT_LENGTH) {
    return NextResponse.json({ error: 'Bio is too long.' }, { status: 400 })
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      messages: [
        {
          role: 'user',
          content: `Improve this expert-profile bio.

Rules:
- Preserve all factual information.
- Do not invent employers, credentials, achievements, years of
  experience, education, or expertise.
- Make it warm, professional, and approachable.
- Focus on what people can ask this expert about.
- Maximum ${MAX_BIO_LENGTH} characters.
- Return only the improved bio, with no preamble or quotation marks.

Bio:
${bio}`,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const improvedBio = textBlock?.text.trim().slice(0, MAX_BIO_LENGTH)

    if (!improvedBio) {
      return NextResponse.json(
        { error: 'Could not improve this bio right now.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ improvedBio })
  } catch (err) {
    await logError('improve-bio', err)
    return NextResponse.json(
      { error: 'Could not improve this bio right now.' },
      { status: 500 }
    )
  }
}
