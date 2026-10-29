import { Document, Font, Link, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import { PUBLIC_SITE_URL } from './site'
import { SIGNATURE_COLORS, type AnswerSignature } from './answer-signature'

// The one-page "personal letter" an asker can keep: the question first, then
// the expert's answer, then their signature. The same function builds the real
// download and the expert's preview, so the preview is exactly what is sent.

const INK = '#17243a'
const SOFT = '#4a5568'
const LINE = '#ddd6c8'
const CORAL = '#d4533f'

// The standard PDF fonts only cover Western European characters, and a letter
// outside them prints as a blank box. Anything else (emoji, other alphabets) is
// left out of the PDF; the answer email still carries the full text.
const SPECIALS = '‘’‚“”„–—•…†‡‰‹›€™'

export function pdfSafeText(text: string): string {
  let out = ''
  for (const ch of text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, '    ')) {
    const code = ch.codePointAt(0) ?? 0
    if (ch === '\n' || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || SPECIALS.includes(ch)) {
      out += ch
    } else if (ch === '­' || code < 0x20 || code === 0x7f) {
      // Soft hyphens and control characters: nothing to show.
    } else if (/\s/.test(ch)) {
      out += ' '
    }
  }
  return out.replace(/[ ]{2,}/g, ' ').replace(/ +\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Words are never split with a hyphen: it looks odd in a letter.
Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    paddingTop: 52,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: INK,
    lineHeight: 1.5,
  },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: CORAL },
  eyebrow: { fontSize: 7.5, letterSpacing: 1, color: CORAL, fontFamily: 'Helvetica-Bold' },
  fromName: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginTop: 4, lineHeight: 1.2 },
  headline: { fontSize: 9.5, color: SOFT, marginTop: 3 },
  rule: { borderBottomWidth: 1, borderBottomColor: LINE, marginTop: 18, marginBottom: 18 },
  question: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 5, lineHeight: 1.35 },
  answerBox: {
    marginTop: 16,
    backgroundColor: '#f4f1ea',
    borderRadius: 6,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  paragraph: { fontSize: 11, lineHeight: 1.55, marginTop: 8 },
  closing: { fontSize: 11, marginTop: 24 },
  sigTitle: { fontSize: 9, color: SOFT, marginTop: 2 },
  footer: { position: 'absolute', bottom: 28, left: 56, right: 56 },
  footerRule: { borderTopWidth: 1, borderTopColor: LINE, marginBottom: 8 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerSmall: { fontSize: 8, color: SOFT },
  footerBrand: { color: CORAL, fontFamily: 'Helvetica-Bold', textDecoration: 'none' },
})

export type AnswerPdfInput = {
  expertName: string
  expertHeadline: string
  question: string
  answer: string
  signature: AnswerSignature
  // Shown in the footer; both optional so the expert's preview can leave them out.
  referenceId?: string | null
  answeredAt?: Date | null
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function AnswerDocument(input: AnswerPdfInput) {
  const name = pdfSafeText(input.signature.name) || pdfSafeText(input.expertName)
  const color = SIGNATURE_COLORS[input.signature.color].hex
  const paragraphs = pdfSafeText(input.answer).split(/\n{2,}/).filter((p) => p.trim())
  const siteLink = `${PUBLIC_SITE_URL}?utm_source=answer-pdf&utm_medium=pdf`
  const meta = [
    input.referenceId ? `Question ${pdfSafeText(input.referenceId)}` : '',
    input.answeredAt ? `Answered ${formatDate(input.answeredAt)}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ')

  return (
    <Document
      title={`Answer from ${pdfSafeText(input.expertName)}`}
      author={pdfSafeText(input.expertName)}
      creator="Drop Me A Question"
      producer="Drop Me A Question"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.topBar} fixed />

        <View>
          <Text style={styles.eyebrow}>A PERSONAL ANSWER FROM</Text>
          <Text style={styles.fromName}>{pdfSafeText(input.expertName)}</Text>
          {input.expertHeadline ? <Text style={styles.headline}>{pdfSafeText(input.expertHeadline)}</Text> : null}
        </View>

        <View style={styles.rule} />

        <View>
          <Text style={styles.eyebrow}>YOUR QUESTION</Text>
          <Text style={styles.question}>{pdfSafeText(input.question)}</Text>
        </View>

        <View style={styles.answerBox}>
          <Text style={styles.eyebrow}>MY ANSWER</Text>
          {paragraphs.map((p, i) => (
            <Text key={i} style={i === 0 ? { ...styles.paragraph, marginTop: 6 } : styles.paragraph}>
              {p}
            </Text>
          ))}
        </View>

        <View wrap={false}>
          <Text style={styles.closing}>{pdfSafeText(input.signature.closing)}</Text>
          <Text
            style={{
              fontSize: 15,
              marginTop: 6,
              color,
              fontFamily: input.signature.boldName ? 'Helvetica-BoldOblique' : 'Helvetica-Oblique',
            }}
          >
            {name}
          </Text>
          {input.signature.title ? <Text style={styles.sigTitle}>{pdfSafeText(input.signature.title)}</Text> : null}
        </View>

        <View style={styles.footer} fixed>
          <View style={styles.footerRule} />
          <View style={styles.footerRow}>
            <Text style={styles.footerSmall}>{meta}</Text>
            <Text style={styles.footerSmall}>
              Powered by{' '}
              <Link src={siteLink} style={styles.footerBrand}>
                Drop Me A Question
              </Link>
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function renderAnswerPdf(input: AnswerPdfInput): Promise<Buffer> {
  return renderToBuffer(<AnswerDocument {...input} />)
}
