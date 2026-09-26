import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

const CARD_SIZE = 1080

const COLORS = {
  paper: '#f8f6f1',
  ink: '#17243a',
  inkSoft: '#4a5568',
  postalRed: '#e45b4f',
  line: '#ddd6c8',
  lavender: '#e9e5f4',
}

let cachedLogoDataUrl: string | null = null

async function getLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl
  const filePath = path.join(process.cwd(), 'public', 'brand', 'logo-lockup.png')
  const file = await readFile(filePath)
  cachedLogoDataUrl = `data:image/png;base64,${file.toString('base64')}`
  return cachedLogoDataUrl
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = (searchParams.get('name') || 'Your Name').slice(0, 60)
  const headline = (searchParams.get('headline') || '').slice(0, 80)
  const topics = (searchParams.get('topics') || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4)
  const avatarUrl = searchParams.get('avatar')
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  const logoDataUrl = await getLogoDataUrl()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: COLORS.paper,
          padding: '80px 90px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              width={200}
              height={200}
              style={{
                borderRadius: '50%',
                objectFit: 'cover',
                border: `4px solid ${COLORS.line}`,
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                width: 200,
                height: 200,
                borderRadius: '50%',
                backgroundColor: COLORS.lavender,
                color: COLORS.ink,
                fontSize: 84,
                fontWeight: 700,
                alignItems: 'center',
                justifyContent: 'center',
                border: `4px solid ${COLORS.line}`,
              }}
            >
              {initial}
            </div>
          )}

          <div
            style={{
              marginTop: 36,
              fontSize: 56,
              fontWeight: 700,
              color: COLORS.ink,
              textAlign: 'center',
            }}
          >
            {name}
          </div>

          {headline ? (
            <div
              style={{
                display: 'flex',
                marginTop: 12,
                fontSize: 30,
                color: COLORS.inkSoft,
                textAlign: 'center',
              }}
            >
              {headline}
            </div>
          ) : null}

          {topics.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 14,
                marginTop: 44,
                maxWidth: 760,
              }}
            >
              {topics.map((topic) => (
                <div
                  key={topic}
                  style={{
                    display: 'flex',
                    padding: '14px 28px',
                    borderRadius: 999,
                    backgroundColor: COLORS.lavender,
                    color: COLORS.ink,
                    fontSize: 26,
                    fontWeight: 600,
                  }}
                >
                  {topic}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '20px 52px',
              borderRadius: 999,
              backgroundColor: COLORS.postalRed,
              color: '#ffffff',
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            Ask me a question
          </div>

          <img
            src={logoDataUrl}
            width={296}
            height={40}
            style={{ marginTop: 44 }}
          />
        </div>
      </div>
    ),
    {
      width: CARD_SIZE,
      height: CARD_SIZE,
    }
  )
}
