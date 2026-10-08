// Records the README tour from the running application.
//   node scripts/record-tour.mjs            (expects the dashboard at REVIEW_BASE, default http://127.0.0.1:3010)
// Writes ../pictures/aegis-tour.webm and ../pictures/aegis-tour.gif. The GIF step needs python3 with Pillow and NumPy.
//   node scripts/record-tour.mjs --gif-only  rebuilds the GIF from the existing WebM.
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const base = process.env.REVIEW_BASE || 'http://127.0.0.1:3010'
const out = resolve(import.meta.dirname, '../../pictures')
const size = { width: 1280, height: 720 }
const work = mkdtempSync(join(tmpdir(), 'aegis-tour-'))

// Overlay layer that lives outside <body>, so it survives client-side navigation and body zooms.
const overlay = () => {
  const style = document.createElement('style')
  style.textContent = `
    nextjs-portal { display: none !important; }
    body { transition: transform 1100ms cubic-bezier(0.16, 1, 0.3, 1); transform-origin: var(--tour-ox, 50%) var(--tour-oy, 50%); }
    #tour { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; font-family: 'IBM Plex Sans Variable', system-ui, sans-serif; }
    #tour * { box-sizing: border-box; }
    #tour .card { position: absolute; inset: 0; display: grid; place-content: center; gap: 14px; padding: 80px; background: #0b1a33; color: #fff; text-align: center; clip-path: inset(0 0 0 0); transition: clip-path 900ms cubic-bezier(0.7, 0, 0.2, 1); }
    #tour .card[data-hidden] { clip-path: inset(0 0 100% 0); }
    #tour .card h1 { margin: 0; font-size: 76px; font-weight: 600; letter-spacing: -0.03em; }
    #tour .card h1 span { display: inline-block; opacity: 0; transform: translateY(26px); filter: blur(10px); animation: rise 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    #tour .card p { margin: 0; color: #a9b9d6; font-size: 24px; opacity: 0; animation: rise 800ms 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    #tour .card small { color: #78a2ff; font-size: 16px; letter-spacing: 0.02em; opacity: 0; animation: rise 800ms 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    #tour .card i { display: block; width: 0; height: 3px; margin: 6px auto; border-radius: 2px; background: #1f4fd8; animation: rule 900ms 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes rise { to { opacity: 1; transform: none; filter: none; } }
    @keyframes rule { to { width: 180px; } }
    #tour .wipe { position: absolute; inset: 0; background: #1f4fd8; transform: translateX(-101%); }
    #tour .wipe[data-run] { animation: wipe 760ms cubic-bezier(0.7, 0, 0.2, 1); }
    @keyframes wipe { 0% { transform: translateX(-101%); } 45%, 55% { transform: none; } 100% { transform: translateX(101%); } }
    #tour .caption { position: absolute; left: 36px; bottom: 34px; display: grid; gap: 2px; max-width: 620px; padding: 14px 20px 15px; border-radius: 12px; background: #0b1a33; color: #fff; box-shadow: 0 2px 6px rgba(7, 18, 38, 0.2), 0 24px 50px -18px rgba(7, 18, 38, 0.6); opacity: 0; transform: translateY(18px); filter: blur(6px); transition: opacity 420ms, transform 520ms cubic-bezier(0.16, 1, 0.3, 1), filter 420ms; }
    #tour .caption[data-on] { opacity: 1; transform: none; filter: none; }
    #tour .caption strong { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
    #tour .caption span { color: #a9b9d6; font-size: 15px; }
    #tour .spot { position: absolute; border-radius: 12px; box-shadow: 0 0 0 9999px rgba(7, 18, 38, 0.56), 0 0 0 2px #78a2ff; opacity: 0; transition: opacity 380ms, left 700ms cubic-bezier(0.16, 1, 0.3, 1), top 700ms cubic-bezier(0.16, 1, 0.3, 1), width 700ms cubic-bezier(0.16, 1, 0.3, 1), height 700ms cubic-bezier(0.16, 1, 0.3, 1); }
    #tour .spot[data-on] { opacity: 1; }
    #tour .cursor { position: absolute; left: 0; top: 0; width: 22px; height: 22px; margin: -4px 0 0 -4px; transform: translate(640px, 760px); transition: transform 780ms cubic-bezier(0.3, 0, 0.1, 1); filter: drop-shadow(0 2px 3px rgba(7, 18, 38, 0.5)); }
    #tour .ripple { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border: 2px solid #1f4fd8; border-radius: 50%; animation: ripple 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes ripple { to { transform: scale(4.4); opacity: 0; } }
    #tour .phone { position: absolute; top: 50%; right: 150px; width: 300px; height: 620px; padding: 10px; border-radius: 40px; background: #071226; box-shadow: 0 0 0 2px #223a63, 0 40px 80px -20px rgba(0, 0, 0, 0.7); transform: translate(0, -50%) translateY(760px) rotate(6deg); transition: transform 1000ms cubic-bezier(0.16, 1, 0.3, 1); }
    #tour .phone[data-on] { transform: translate(0, -50%); }
    #tour .phone iframe { width: 390px; height: 836px; border: 0; border-radius: 42px; transform: scale(0.718); transform-origin: 0 0; background: #f2f5fa; }
    #tour .backdrop { position: absolute; inset: 0; background: #0b1a33; opacity: 0; transition: opacity 600ms; }
    #tour .backdrop[data-on] { opacity: 1; }
    #tour .aside { position: absolute; left: 150px; top: 50%; width: 520px; color: #fff; transform: translateY(-50%); opacity: 0; transition: opacity 700ms 300ms; }
    #tour .aside[data-on] { opacity: 1; }
    #tour .aside h2 { margin: 0 0 12px; font-size: 44px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
    #tour .aside p { margin: 0; color: #a9b9d6; font-size: 20px; line-height: 1.5; }
  `
  document.documentElement.appendChild(style)
  const root = document.createElement('div')
  root.id = 'tour'
  root.innerHTML = `
    <div class="spot"></div>
    <div class="caption"><strong></strong><span></span></div>
    <div class="backdrop"></div>
    <div class="aside"><h2></h2><p></p></div>
    <div class="phone"><iframe title="Mobile preview"></iframe></div>
    <svg class="cursor" viewBox="0 0 22 22"><path d="M4 3l13 6.2-5.4 1.9-1.9 5.4z" fill="#fff" stroke="#0b1a33" stroke-width="1.6" stroke-linejoin="round"/></svg>
    <div class="wipe"></div>
    <div class="card"><h1></h1><i></i><p></p><small></small></div>`
  document.documentElement.appendChild(root)
  const $ = (selector) => root.querySelector(selector)
  window.tour = {
    card(title, line, note) {
      const card = $('.card')
      card.querySelector('h1').innerHTML = title.split(' ').map((word, index) => `<span style="animation-delay:${index * 140}ms">${word}</span>`).join(' ')
      card.querySelector('p').textContent = line
      card.querySelector('small').textContent = note
      card.removeAttribute('data-hidden')
    },
    hideCard() { $('.card').setAttribute('data-hidden', '') },
    wipe() { const wipe = $('.wipe'); wipe.removeAttribute('data-run'); void wipe.offsetWidth; wipe.setAttribute('data-run', '') },
    caption(title, line) {
      const caption = $('.caption')
      caption.removeAttribute('data-on')
      if (!title) return
      setTimeout(() => { caption.querySelector('strong').textContent = title; caption.querySelector('span').textContent = line || ''; caption.setAttribute('data-on', '') }, 260)
    },
    spot(selector, pad = 8) {
      const spot = $('.spot')
      const target = selector && document.querySelector(selector)
      if (!target) { spot.removeAttribute('data-on'); return }
      const box = target.getBoundingClientRect()
      Object.assign(spot.style, { left: `${box.left - pad}px`, top: `${box.top - pad}px`, width: `${box.width + pad * 2}px`, height: `${box.height + pad * 2}px` })
      spot.setAttribute('data-on', '')
    },
    cursor(x, y) { $('.cursor').style.transform = `translate(${x}px, ${y}px)` },
    ripple(x, y) { const ripple = document.createElement('div'); ripple.className = 'ripple'; ripple.style.left = `${x}px`; ripple.style.top = `${y}px`; root.appendChild(ripple); setTimeout(() => ripple.remove(), 700) },
    zoom(scale, ox = 50, oy = 50) { document.body.style.setProperty('--tour-ox', `${ox}%`); document.body.style.setProperty('--tour-oy', `${oy}%`); document.body.style.transform = scale === 1 ? '' : `scale(${scale})` },
    phone(src, title, line) {
      const on = Boolean(src)
      for (const name of ['.phone', '.backdrop', '.aside']) $(name).toggleAttribute('data-on', on)
      if (on) { $('.phone iframe').src = src; $('.aside h2').textContent = title; $('.aside p').textContent = line }
    },
  }
}

const webm = join(out, 'aegis-tour.webm')
if (!process.argv.includes('--gif-only')) await record()

// Frames for the GIF come out of the WebM through the ffmpeg build Playwright already ships.
const cache = join(homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright')
const ffmpegDir = readdirSync(cache).filter((name) => name.startsWith('ffmpeg-')).sort().at(-1)
const ffmpeg = join(cache, ffmpegDir, readdirSync(join(cache, ffmpegDir)).find((name) => name.startsWith('ffmpeg')))
// The bundled build has no fps or scale filters, so rate and size are output options.
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', webm, '-r', '8', '-s', '720x405', join(work, 'f-%04d.png')])
execFileSync('python3', [resolve(import.meta.dirname, 'tour_gif.py'), work, join(out, 'aegis-tour.gif')], { stdio: 'inherit' })
rmSync(work, { recursive: true, force: true })
console.log('wrote', webm, 'and aegis-tour.gif')

async function record() {
  const browser = await chromium.launch()

  // Warm every route first so the recording never shows a compile or a cold query.
  const warm = await (await browser.newContext({ viewport: size })).newPage()
  for (const route of ['/', '/readiness?view=incidents', '/readiness?view=incidents&pane=map', '/readiness?view=incidents&pane=timeline', '/readiness?view=units', '/readiness?view=units&pane=history', '/shifts', '/analytics']) {
    await warm.goto(base + route, { waitUntil: 'networkidle' })
  }
  await warm.context().close()

  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, recordVideo: { dir: work, size } })
  // Hide the dev indicator in every frame, and keep the top page covered until the title card is up.
  await context.addInitScript(() => {
    // A constructed stylesheet is not a DOM node, so hydration cannot remove it.
    const sheet = new CSSStyleSheet()
    sheet.replaceSync('nextjs-portal { display: none !important; }' + (window.top === window ? ' html { background: #0b1a33 !important; } body { opacity: 0 !important; }' : ''))
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
    window.tourCover = sheet
  })
  const page = await context.newPage()
  const wait = (ms) => page.waitForTimeout(ms)
  const tour = (method, ...args) => page.evaluate(([name, values]) => window.tour[name](...values), [method, args])

  async function point(locator, { click = true } = {}) {
    const box = await locator.boundingBox()
    const x = box.x + Math.min(box.width / 2, 120), y = box.y + box.height / 2
    await tour('cursor', x, y)
    await wait(800)
    if (!click) return
    await tour('ripple', x, y)
    await page.mouse.click(x, y)
  }
  async function scene(navName, title, line) {
    await tour('spot', null)
    await tour('caption', null)
    await tour('wipe')
    await wait(330)
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: navName, exact: true }).click()
    await wait(650)
    await tour('caption', title, line)
  }

  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.evaluate(overlay)
  await tour('card', 'Aegis Command', 'Readiness, incidents, and staffing in one operating picture', 'Unofficial concept · synthetic data')
  await page.evaluate(() => window.tourCover.replaceSync('nextjs-portal { display: none !important; }'))
  await page.locator('[data-map-station]').first().waitFor()
  await wait(2300)

  // County overview
  await tour('hideCard')
  await wait(550)
  await tour('caption', 'County overview', '39 stations, active incidents, and open alerts at a glance')
  await wait(700)
  await tour('spot', '.ui-summary')
  await wait(1350)
  await tour('spot', '[data-map="readiness"]', 0)
  await wait(500)
  await tour('zoom', 1.32, 38, 62)
  await wait(1500)
  await tour('zoom', 1)
  await tour('spot', null)
  await wait(800)
  await point(page.locator('[data-map-station="fs-21"]'))
  await tour('caption', 'Select anything', 'A station, unit, or incident opens beside the work')
  await wait(1700)

  // Incidents: one selection across register, map, and timeline
  await scene('Incidents', 'Incidents', 'One selection across the register, the map, and the timeline')
  await wait(550)
  await point(page.locator('[data-ui="incident-register"] tbody tr').nth(2).locator('th button'))
  await wait(1050)
  await point(page.getByRole('tab', { name: 'Map', exact: true }))
  await wait(1200)
  await point(page.getByRole('tab', { name: 'Timeline', exact: true }))
  await wait(500)
  await tour('spot', '[data-ui="incident-timeline"]', 0)
  await tour('caption', 'Recorded, not assumed', 'Lifecycle stages come from the audit history')
  await wait(1850)

  // Units
  await scene('Units', 'Units', 'Crew, readiness checks, and service state for every apparatus')
  await wait(550)
  await point(page.locator('[data-ui="unit-row"]').nth(3))
  await wait(1050)
  await point(page.getByRole('tab', { name: 'Deployment history', exact: true }))
  await wait(550)
  await tour('spot', '[data-ui="unit-timeline"]', 0)
  await wait(1750)

  // Scheduling
  await scene('Scheduling', 'Scheduling', 'The duty timeline shows coverage gaps for the day')
  await wait(700)
  await tour('spot', '[aria-labelledby="duty-heading"]', 0)
  await wait(1850)

  // Analytics
  await scene('Analytics', 'Analytics', 'One analysis at a time, with findings and exportable evidence')
  await wait(900)
  await tour('zoom', 1.18, 45, 60)
  await wait(1700)
  await tour('zoom', 1)
  await wait(550)

  // Command search
  await tour('caption', 'Search everything', 'Workspaces, stations, units, and active incidents')
  await point(page.getByRole('button', { name: 'Search unit, station, incident, location' }))
  await wait(400)
  await page.keyboard.type('fair oaks', { delay: 95 })
  await wait(1500)
  await page.keyboard.press('Escape')
  await tour('caption', null)
  await wait(300)

  // Mobile
  await tour('cursor', 640, 780)
  await tour('phone', base + '/readiness?view=incidents', 'Complete on a phone', 'Every workflow fits 320px and up, with 44px touch targets and drawers in place of side panels.')
  await wait(2900)

  // Close
  await tour('card', 'Aegis Command', 'FastAPI · PostgreSQL · Kafka · Redis · Next.js', 'Unofficial concept · synthetic data · not for dispatch')
  await wait(2400)

  const video = page.video()
  await context.close()
  await browser.close()
  renameSync(await video.path(), webm)
}
