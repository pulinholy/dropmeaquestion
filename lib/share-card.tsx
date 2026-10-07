import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

export type ShareCardStyle = 'profile' | 'topic'

export type ShareCardData = {
  style: ShareCardStyle
  name: string
  headline: string
  topics: string[]
  // Profile card: this topic is emphasised among the pills.
  // Topic card: this topic is the headline.
  highlightTopic: string | null
  avatarDataUrl: string | null
  displayUrl: string
}

const COLORS = {
  paper: '#f8f6f1',
  card: '#fdfbf7',
  ink: '#17243a',
  inkSoft: '#4a5568',
  coral: '#e45b4f',
  coralSoft: '#f7d9d3',
  line: '#ddd6c8',
  lavender: '#e9e5f4',
  lavenderDeep: '#d9d3ee',
}

type CachedAssets = {
  fonts: { name: string; data: Buffer; weight: 400 | 600 | 700; style: 'normal' }[]
  logo: string
}
let assetsPromise: Promise<CachedAssets> | null = null

function loadAssets(): Promise<CachedAssets> {
  if (!assetsPromise) {
    // Literal paths so Vercel's file tracing bundles these with the function.
    assetsPromise = Promise.all([
      readFile(path.join(process.cwd(), 'assets', 'fonts', 'fraunces-latin-700-normal.woff')),
      readFile(path.join(process.cwd(), 'assets', 'fonts', 'public-sans-latin-400-normal.woff')),
      readFile(path.join(process.cwd(), 'assets', 'fonts', 'public-sans-latin-600-normal.woff')),
      readFile(path.join(process.cwd(), 'assets', 'fonts', 'public-sans-latin-700-normal.woff')),
      readFile(path.join(process.cwd(), 'public', 'brand', 'logo-lockup.png')),
    ]).then(([fraunces, sans400, sans600, sans700, logo]) => ({
      fonts: [
        { name: 'Fraunces', data: fraunces, weight: 700 as const, style: 'normal' as const },
        { name: 'Public Sans', data: sans400, weight: 400 as const, style: 'normal' as const },
        { name: 'Public Sans', data: sans600, weight: 600 as const, style: 'normal' as const },
        { name: 'Public Sans', data: sans700, weight: 700 as const, style: 'normal' as const },
      ],
      logo: `data:image/png;base64,${logo.toString('base64')}`,
    }))
    assetsPromise.catch(() => {
      assetsPromise = null
    })
  }
  return assetsPromise
}

const MAX_AVATAR_BYTES = 3 * 1024 * 1024

function imageKind(bytes: Buffer): 'png' | 'jpeg' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png'
  }
  return null
}

// The avatar address comes from a column the expert can edit, so it is never
// fetched blindly: it must be one of our Supabase avatar objects, is size and
// time limited, and is checked to really be an image before it goes near the
// renderer. Anything else falls back to an initial.
export async function fetchAvatarDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const isOurStorage =
    parsed.protocol === 'https:' &&
    parsed.hostname.endsWith('.supabase.co') &&
    parsed.pathname.startsWith('/storage/v1/object/public/avatars/')
  if (!isOurStorage) return null

  try {
    const res = await fetch(parsed, {
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    })
    if (!res.ok) return null

    const declared = Number(res.headers.get('content-length') ?? 0)
    if (declared > MAX_AVATAR_BYTES) return null

    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return null

    const kind = imageKind(bytes)
    if (kind) return `data:image/${kind};base64,${bytes.toString('base64')}`

    // WebP (allowed for uploads) isn't decoded by the renderer; convert it.
    const sharp = (await import('sharp')).default
    const png = await sharp(bytes).resize(600, 600, { fit: 'cover' }).png().toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

function Avatar({
  src,
  name,
  size,
}: {
  src: string | null
  name: string
  size: number
}) {
  if (src) {
    return (
      <img
        src={src}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: size,
          objectFit: 'cover',
          border: `6px solid ${COLORS.card}`,
        }}
      />
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size,
        backgroundColor: COLORS.lavender,
        color: COLORS.ink,
        fontFamily: 'Fraunces',
        fontWeight: 700,
        fontSize: size * 0.42,
        alignItems: 'center',
        justifyContent: 'center',
        border: `6px solid ${COLORS.card}`,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}

function TopicPill({ label, highlighted }: { label: string; highlighted: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        padding: '14px 30px',
        borderRadius: 999,
        backgroundColor: highlighted ? COLORS.coral : COLORS.lavender,
        color: highlighted ? '#ffffff' : COLORS.ink,
        fontFamily: 'Public Sans',
        fontWeight: 600,
        fontSize: 28,
      }}
    >
      {label}
    </div>
  )
}

function Decoration() {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: -150,
          right: -130,
          width: 440,
          height: 440,
          borderRadius: 440,
          backgroundColor: COLORS.coralSoft,
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 150,
          right: 120,
          width: 70,
          height: 10,
          borderRadius: 10,
          backgroundColor: COLORS.coral,
          transform: 'rotate(-55deg)',
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 120,
          right: 190,
          width: 56,
          height: 10,
          borderRadius: 10,
          backgroundColor: COLORS.coral,
          transform: 'rotate(-85deg)',
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 205,
          right: 70,
          width: 48,
          height: 10,
          borderRadius: 10,
          backgroundColor: COLORS.coral,
          transform: 'rotate(-30deg)',
          display: 'flex',
        }}
      />
    </>
  )
}

function Footer({ displayUrl, tagline }: { displayUrl: string; tagline: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: '30px 0',
          borderRadius: 999,
          backgroundColor: COLORS.coral,
          color: '#ffffff',
          fontFamily: 'Public Sans',
          fontWeight: 700,
          fontSize: 40,
        }}
      >
        Drop me a question →
      </div>
      {tagline ? (
        <div
          style={{
            display: 'flex',
            marginTop: 26,
            fontFamily: 'Public Sans',
            fontWeight: 400,
            fontSize: 28,
            color: COLORS.inkSoft,
          }}
        >
          People have questions. You have answers.
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          marginTop: tagline ? 10 : 26,
          fontFamily: 'Public Sans',
          fontWeight: 600,
          fontSize: 30,
          color: COLORS.ink,
        }}
      >
        {displayUrl}
      </div>
    </div>
  )
}

// Long names wrap onto several lines and would push the pills into the button.
function nameFontSize(name: string): number {
  if (name.length <= 18) return 80
  if (name.length <= 28) return 64
  return 50
}

function ProfileCard({ data, logo }: { data: ShareCardData; logo: string }) {
  const topics = data.topics.slice(0, 4)
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.paper,
        padding: '72px 80px',
        overflow: 'hidden',
      }}
    >
      <Decoration />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignSelf: 'flex-start' }}>
          <img src={logo} width={300} height={40} />
        </div>

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 470,
            height: 440,
            marginTop: 30,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 60,
              width: 330,
              height: 330,
              borderRadius: 330,
              backgroundColor: COLORS.lavender,
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 130,
              width: 250,
              height: 250,
              borderRadius: 250,
              backgroundColor: COLORS.lavenderDeep,
              display: 'flex',
            }}
          />
          <Avatar src={data.avatarDataUrl} name={data.name} size={390} />
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 26,
            fontFamily: 'Fraunces',
            fontWeight: 700,
            fontSize: nameFontSize(data.name),
            color: COLORS.ink,
            textAlign: 'center',
            lineHeight: 1.05,
          }}
        >
          {data.name}
        </div>

        {data.headline ? (
          <div
            style={{
              display: 'flex',
              marginTop: 14,
              fontFamily: 'Public Sans',
              fontWeight: 600,
              fontSize: 36,
              color: COLORS.ink,
              textAlign: 'center',
            }}
          >
            {data.headline}
          </div>
        ) : null}

        {topics.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 14,
              marginTop: 34,
              maxWidth: 880,
            }}
          >
            {topics.map((topic) => (
              <TopicPill key={topic} label={topic} highlighted={topic === data.highlightTopic} />
            ))}
          </div>
        ) : null}
      </div>

      <Footer displayUrl={data.displayUrl} tagline />
    </div>
  )
}

function topicHeadlineSize(topic: string): number {
  if (topic.length <= 14) return 132
  if (topic.length <= 24) return 108
  return 84
}

function TopicCard({ data, logo }: { data: ShareCardData; logo: string }) {
  const topic = data.highlightTopic ?? data.topics[0] ?? 'anything'
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.paper,
        padding: '72px 80px',
        overflow: 'hidden',
      }}
    >
      <Decoration />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex' }}>
          <img src={logo} width={300} height={40} />
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 120,
            fontFamily: 'Public Sans',
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 5,
            textTransform: 'uppercase',
            color: COLORS.coral,
          }}
        >
          Ask me about
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 26,
            fontFamily: 'Fraunces',
            fontWeight: 700,
            fontSize: 70,
            lineHeight: 1.1,
            color: COLORS.ink,
          }}
        >
          Have a question about
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 6,
            fontFamily: 'Fraunces',
            fontWeight: 700,
            fontSize: topicHeadlineSize(topic),
            lineHeight: 1.05,
            color: COLORS.coral,
          }}
        >
          {topic}?
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            marginBottom: 56,
            padding: '28px 32px',
            borderRadius: 32,
            backgroundColor: COLORS.card,
            border: `2px solid ${COLORS.line}`,
          }}
        >
          <Avatar src={data.avatarDataUrl} name={data.name} size={150} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Fraunces',
                fontWeight: 700,
                fontSize: 50,
                color: COLORS.ink,
                lineHeight: 1.1,
              }}
            >
              {data.name}
            </div>
            {data.headline ? (
              <div
                style={{
                  display: 'flex',
                  marginTop: 8,
                  fontFamily: 'Public Sans',
                  fontWeight: 400,
                  fontSize: 30,
                  color: COLORS.inkSoft,
                }}
              >
                {data.headline}
              </div>
            ) : null}
          </div>
        </div>

        <Footer displayUrl={data.displayUrl} tagline={false} />
      </div>
    </div>
  )
}

export async function renderShareCard(data: ShareCardData): Promise<ImageResponse> {
  const { fonts, logo } = await loadAssets()
  const useTopicCard = data.style === 'topic' && data.topics.length > 0

  return new ImageResponse(
    useTopicCard ? <TopicCard data={data} logo={logo} /> : <ProfileCard data={data} logo={logo} />,
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts,
      headers: { 'Cache-Control': 'private, no-store' },
    }
  )
}
