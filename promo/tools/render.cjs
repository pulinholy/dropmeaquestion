// Renders explainer.html to an MP4, frame by frame, so the result is exact and
// needs no screen recording. Usage:
//   node render.cjs            -> promo/out/dmq-explainer-16x9.mp4  (1920x1080)
//   node render.cjs --vertical -> promo/out/dmq-explainer-9x16.mp4  (1080x1920)
//   add --seconds 6 to render only the first few seconds (a quick test)
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer-core')
const ffmpegPath = require('ffmpeg-static')

const vertical = process.argv.includes('--vertical')
const secIdx = process.argv.indexOf('--seconds')
const fileIdx = process.argv.indexOf('--file')
const htmlFile = fileIdx > -1 ? process.argv[fileIdx + 1] : 'explainer.html'
const nameIdx = process.argv.indexOf('--name')
const baseName = nameIdx > -1 ? process.argv[nameIdx + 1] : 'dmq-explainer'
const onlySeconds = secIdx > -1 ? parseFloat(process.argv[secIdx + 1]) : null
const FPS = 30
const W = vertical ? 1080 : 1920
const H = vertical ? 1920 : 1080

const page_path = path.resolve(__dirname, '..', htmlFile)
const out = path.resolve(
  __dirname,
  '..',
  'out',
  baseName + (vertical ? '-9x16.mp4' : '-16x9.mp4')
)
const EDGE = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p))
if (!EDGE) throw new Error('No Edge or Chrome found')

;(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const profile = path.join(require('os').tmpdir(), 'dmq-render-profile-' + Date.now())
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    userDataDir: profile,
    args: ['--hide-scrollbars', '--allow-file-access-from-files', '--no-first-run', '--no-default-browser-check'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
  const url = 'file:///' + page_path.replace(/\\/g, '/') + '?t=0' + (vertical ? '&v=1' : '')
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => Promise.all([
    document.fonts.load('600 40px Fraunces'),
    document.fonts.load('500 40px "Public Sans"'),
    document.fonts.load('600 40px "Public Sans"'),
  ]))
  const fontsOk = await page.evaluate(
    () => document.fonts.check('600 40px Fraunces') && document.fonts.check('500 40px "Public Sans"')
  )
  if (!fontsOk) console.warn('WARNING: the brand fonts did not load; text will use fallbacks')

  const ff = spawn(
    ffmpegPath,
    [
      '-y',
      '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'medium',
      '-c:a', 'aac', '-b:a', '128k', '-shortest',
      '-movflags', '+faststart',
      out,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  )
  const done = new Promise((resolve, reject) => {
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited ' + code))))
    ff.on('error', reject)
  })

  // The picture holds its last frame for two seconds after the animation ends.
  const pageEnd = await page.evaluate(() => window.dmqEnd)
  const seconds = onlySeconds !== null ? onlySeconds : (pageEnd ? pageEnd + 2 : 64)
  const total = Math.round(seconds * FPS)
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.dmqSeek(t), i / FPS)
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 })
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
    if (i % 150 === 0) console.log(`frame ${i}/${total}`)
  }
  ff.stdin.end()
  await done
  await browser.close()
  console.log('done:', out)
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
