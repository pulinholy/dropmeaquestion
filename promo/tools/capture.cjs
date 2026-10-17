// Records short, smooth clips of the real site: a scripted visitor scrolls,
// moves a visible cursor, types and clicks, and every frame is saved and
// assembled into an MP4. Nothing is clicked that would change data.
//
//   node capture.cjs intro|page|closing [--site https://www.dropmeaquestion.com]
//   node capture.cjs --list
//
// Clips that need a signed-in page (pricing, questions) use a browser profile
// the person signs in to themselves:
//   node capture.cjs --login      (opens a window; sign in; close it)
//   node capture.cjs pricing|share|followup
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer-core')
const ffmpegPath = require('ffmpeg-static')

const args = process.argv.slice(2)
const siteIdx = args.indexOf('--site')
const SITE = (siteIdx > -1 ? args[siteIdx + 1] : 'https://www.dropmeaquestion.com').replace(/\/$/, '')
const clipName = args.find((a) => !a.startsWith('--') && a !== (siteIdx > -1 ? args[siteIdx + 1] : null))
const FPS = 30
const VW = 1280
const VH = 720
const DSF = 1.5 // 1280x720 x 1.5 = 1920x1080, with larger, crisper text
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => fs.existsSync(p))
const PROFILE = path.resolve(__dirname, '.profile') // sign-in lives here, on this computer only

const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

class Recorder {
  constructor(page, ff) {
    this.page = page
    this.ff = ff
    this.cx = VW * 0.62
    this.cy = VH * 0.6
    this.pulse = -1 // seconds since the last click
    this.frames = 0
  }

  async install() {
    await this.page.evaluate(() => {
      if (document.getElementById('__cur')) return
      const c = document.createElement('div')
      c.id = '__cur'
      c.style.cssText = 'position:fixed;left:0;top:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))'
      c.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M3 2l7 19 3-8 8-3z" fill="#fff" stroke="#17243a" stroke-width="1.6" stroke-linejoin="round"/></svg>'
      const r = document.createElement('div')
      r.id = '__rip'
      r.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #e45b4f;z-index:2147483646;pointer-events:none;opacity:0'
      document.documentElement.appendChild(r)
      document.documentElement.appendChild(c)
    })
  }

  async draw() {
    await this.page.evaluate(
      (x, y, pulse) => {
        const c = document.getElementById('__cur')
        const r = document.getElementById('__rip')
        if (c) c.style.transform = `translate(${x - 4}px,${y - 3}px)`
        if (r) {
          if (pulse >= 0 && pulse < 0.5) {
            const k = pulse / 0.5
            r.style.left = x + 'px'
            r.style.top = y + 'px'
            r.style.opacity = String(1 - k)
            r.style.transform = `scale(${0.5 + k * 1.1})`
          } else r.style.opacity = '0'
        }
      },
      this.cx,
      this.cy,
      this.pulse
    )
  }

  async frame() {
    await this.draw()
    const buf = await this.page.screenshot({ type: 'jpeg', quality: 95 })
    if (!this.ff.stdin.write(buf)) await new Promise((r) => this.ff.stdin.once('drain', r))
    this.frames++
    if (this.pulse >= 0) this.pulse += 1 / FPS
  }

  async hold(sec) {
    const n = Math.round(sec * FPS)
    for (let i = 0; i < n; i++) await this.frame()
  }

  async anim(sec, step) {
    const n = Math.max(1, Math.round(sec * FPS))
    for (let i = 1; i <= n; i++) {
      await step(ease(i / n), i / n)
      await this.frame()
    }
  }

  async goto(url, settle = 1.0) {
    await this.page.goto(url.startsWith('http') ? url : SITE + url, { waitUntil: 'networkidle2' })
    await this.page.evaluate(() => document.fonts && document.fonts.ready)
    await this.page.evaluate(() => (document.documentElement.style.scrollBehavior = 'auto'))
    await this.install()
    await wait(600)
    await this.hold(settle)
  }

  async scrollTo(selectorOrY, sec, offset = 0) {
    const from = await this.page.evaluate(() => window.scrollY)
    const to =
      typeof selectorOrY === 'number'
        ? selectorOrY
        : await this.page.evaluate(
            (sel, off) => {
              const el = document.querySelector(sel)
              return el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - off) : window.scrollY
            },
            selectorOrY,
            offset
          )
    await this.anim(sec, async (e) => {
      await this.page.evaluate((y) => window.scrollTo(0, y), from + (to - from) * e)
    })
  }

  async center(sel) {
    return this.page.evaluate((s) => {
      const el = document.querySelector(s)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }, sel)
  }

  // The centre of the first visible button, link or label whose text matches.
  async centerText(text) {
    return this.page.evaluate((t) => {
      const els = [...document.querySelectorAll('button, a, label, span, h2')]
      const el = els.find((e) => (e.innerText || '').trim().toLowerCase().startsWith(t.toLowerCase()) && e.getBoundingClientRect().width > 0)
      if (!el) return null
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }, text)
  }

  async clickText(text) {
    await this.page.evaluate((t) => {
      const els = [...document.querySelectorAll('button, a, label')]
      const el = els.find((e) => (e.innerText || '').trim().toLowerCase().startsWith(t.toLowerCase()) && e.getBoundingClientRect().width > 0)
      el?.click()
    }, text)
  }

  async moveTo(target, sec, dx = 0, dy = 0) {
    const t = typeof target === 'string' ? await this.center(target) : target
    if (!t) return
    const fx = this.cx
    const fy = this.cy
    await this.anim(sec, async (e) => {
      this.cx = fx + (t.x + dx - fx) * e
      this.cy = fy + (t.y + dy - fy) * e
    })
  }

  async click(sec = 0.5) {
    this.pulse = 0
    await this.hold(sec)
  }

  async type(sel, text, sec) {
    await this.page.evaluate((s) => document.querySelector(s)?.focus(), sel)
    await this.anim(sec, async (_e, p) => {
      const n = Math.floor(p * text.length)
      await this.page.evaluate(
        (s, v) => {
          const el = document.querySelector(s)
          if (!el) return
          const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
          Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
          el.dispatchEvent(new Event('input', { bubbles: true }))
        },
        sel,
        text.slice(0, n)
      )
    })
  }
}

// ----------------------------- the clips -----------------------------------
const clips = {
  // 1. Introduction (about 10 s): the home page headline, then Maya's example card.
  async intro(r) {
    await r.goto('/', 1.0)
    await r.hold(1.8)
    await r.moveTo('a[href="/maya"], a[href^="/maya"]', 1.6, 0, 20)
    await r.hold(2.2)
    await r.scrollTo('#how', 3.0, 30)
    await r.hold(0.4)
  },

  // 2. Her page (about 12 s): Maya's public page, then the question box.
  async page(r) {
    await r.goto('/maya', 1.0)
    await r.hold(2.0)
    await r.scrollTo(520, 3.0)
    await r.moveTo('textarea', 1.2, 0, 10)
    await r.click(0.4)
    await r.type('textarea', 'How should I choose between two job offers?', 2.6)
    await r.moveTo('button[type="submit"]', 1.2)
    await r.hold(0.8)
  },

  // 6. Closing (about 10 s): back on Maya's page, then the "Create your page" button.
  async closing(r) {
    await r.goto('/maya', 0.8)
    await r.hold(1.2)
    await r.goto('/', 0.6)
    await r.scrollTo('#start', 2.6, 80)
    await r.moveTo('#start a[href="/register"]', 1.4)
    await r.hold(2.8)
  },

  // Clips below need a signed-in browser (run --login once). They only look:
  // nothing is typed into a settings field and nothing is saved.

  // 3. Pricing (about 12 s): the price and response time.
  async pricing(r) {
    await r.goto('/dashboard/pricing', 1.2)
    await r.hold(1.6)
    await r.moveTo('#question-price', 1.4)
    await r.hold(2.4)
    await r.moveTo('select', 1.4)
    await r.hold(1.6)
    await r.scrollTo(260, 2.4)
    await r.hold(0.6)
  },

  // 4. Share and answer (about 15 s): copy the link, then an answered question.
  async share(r) {
    await r.goto('/dashboard', 1.2)
    await r.hold(1.2)
    const copy = await r.centerText('Copy link')
    if (copy) {
      await r.moveTo(copy, 1.6)
      await r.click(0.4)
      await r.clickText('Copy link')
      await r.hold(1.4)
    }
    await r.goto('/dashboard/questions/answered', 1.2)
    await r.hold(1.4)
    const view = await r.centerText('Answered')
    const open = await r.centerText('Answered ·')
    if (open) {
      await r.moveTo(open, 1.4)
      await r.click(0.3)
      await r.clickText('Answered ·')
    }
    await r.hold(3.2)
  },

  // 5. Follow-up conversations (about 15 s): the switch, price and explanation.
  async followup(r) {
    await r.goto('/dashboard/pricing', 1.0)
    await r.scrollTo('#follow-up-switch-label', 2.4, 160)
    await r.hold(1.2)
    await r.moveTo('#follow-up-switch-label', 1.0, 280, 0)
    await r.hold(1.2)
    await r.moveTo('#follow-up-price', 1.2)
    await r.hold(2.0)
    const how = await r.centerText('How follow-up conversations work')
    if (how) {
      await r.moveTo(how, 1.2)
      await r.click(0.3)
      await r.clickText('How follow-up conversations work')
    }
    await r.hold(3.0)
  },
}

// ----------------------------- runner --------------------------------------
async function main() {
  if (args.includes('--list')) {
    console.log(Object.keys(clips).join('\n'))
    return
  }
  if (!CHROME) throw new Error('Google Chrome was not found')

  if (args.includes('--login')) {
    const b = await puppeteer.launch({
      executablePath: CHROME,
      headless: false,
      userDataDir: PROFILE,
      defaultViewport: null,
      args: ['--no-first-run', '--no-default-browser-check'],
    })
    const p = (await b.pages())[0] || (await b.newPage())
    await p.goto(SITE + '/login')
    console.log('A Chrome window is open. Sign in there yourself, then close the window.')
    await new Promise((resolve) => b.on('disconnected', resolve))
    console.log('Window closed. The sign-in stays on this computer only.')
    return
  }

  const run = clips[clipName]
  if (!run) throw new Error('Unknown clip. Try: ' + Object.keys(clips).join(', '))

  const out = path.resolve(__dirname, '..', 'out', 'clips', `clip-${clipName}.mp4`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const needsLogin = ['pricing', 'share', 'followup'].includes(clipName)
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: needsLogin ? PROFILE : path.join(os.tmpdir(), 'dmq-cap-' + Date.now()),
    args: ['--hide-scrollbars', '--no-first-run'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: DSF })

  const ff = spawn(
    ffmpegPath,
    [
      '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium',
      '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out,
    ],
    { stdio: ['pipe', 'ignore', 'inherit'] }
  )
  const done = new Promise((res, rej) => {
    ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c))))
    ff.on('error', rej)
  })

  const rec = new Recorder(page, ff)
  await run(rec)
  ff.stdin.end()
  await done
  await browser.close()
  console.log(`done: ${out} (${(rec.frames / FPS).toFixed(1)} s)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
