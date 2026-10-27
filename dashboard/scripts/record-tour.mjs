// Records the README tour from the running application.
//   node scripts/record-tour.mjs            (expects the dashboard at REVIEW_BASE, default http://127.0.0.1:3010)
// Writes ../pictures/aegis-tour.webp (the README animation) and ../pictures/aegis-tour.webm. The WebP step needs python3 with Pillow.
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const base = process.env.REVIEW_BASE || 'http://127.0.0.1:3010'
const out = resolve(import.meta.dirname, '../../pictures')
// 1600×900 CSS pixels fits the map, summary strip, and queue in one view; 1.2× gives 1080p frames.
const size = { width: 1600, height: 900 }
const scale = 1.2
const length = 30
const work = mkdtempSync(join(tmpdir(), 'aegis-tour-'))
// Tysons Corner: dense 3D buildings, an active incident inside the 1-mile ring, and a response arc to it.
const focusStation = 'fs-29'
const focusIncident = 'Stringfellow'

// Overlay layer that lives outside <body>, so it survives client-side navigation.
const overlay = (length) => {
  const style = document.createElement('style')
  style.textContent = `
    nextjs-portal { display: none !important; }
    #tour { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; font-family: 'IBM Plex Sans Variable', system-ui, sans-serif; }
    #tour * { box-sizing: border-box; }
    #tour .hud { position: absolute; left: 24px; bottom: 26px; display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; min-width: 380px; max-width: 560px; padding: 14px 20px 15px 16px; background: rgba(8, 10, 13, 0.88); backdrop-filter: blur(10px); border: 1px solid rgba(111, 151, 255, 0.28); color: #fff; opacity: 0; transform: translateX(-14px); clip-path: inset(0 100% 0 0); transition: opacity 260ms, transform 420ms cubic-bezier(0.16, 1, 0.3, 1), clip-path 520ms cubic-bezier(0.16, 1, 0.3, 1); }
    #tour .hud[data-on] { opacity: 1; transform: none; clip-path: inset(0 0 0 0); }
    #tour .hud::before, #tour .hud::after { content: ''; position: absolute; width: 10px; height: 10px; border: 0 solid #6f97ff; }
    #tour .hud::before { left: -1px; top: -1px; border-left-width: 2px; border-top-width: 2px; }
    #tour .hud::after { right: -1px; bottom: -1px; border-right-width: 2px; border-bottom-width: 2px; }
    #tour .hud .idx { align-self: stretch; display: grid; place-items: center; padding-right: 14px; border-right: 1px solid rgba(111, 151, 255, 0.28); color: #6f97ff; font: 500 15px/1 'IBM Plex Mono', ui-monospace, monospace; }
    #tour .hud b { display: block; margin-bottom: 4px; color: #9fb7ff; font: 500 12px/1.2 'IBM Plex Mono', ui-monospace, monospace; letter-spacing: 0.16em; text-transform: uppercase; }
    #tour .hud span:last-child { display: block; color: #e8ecf2; font-size: 18px; line-height: 1.3; letter-spacing: -0.005em; }
    #tour .progress { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: linear-gradient(90deg, #3e6ef0, #6f97ff); box-shadow: 0 0 12px rgba(111, 151, 255, 0.7); transform-origin: 0 50%; transform: scaleX(0); animation: progress ${length}s linear forwards; }
    @keyframes progress { to { transform: scaleX(1); } }
    #tour .veil { position: absolute; inset: 0; background: rgba(8, 10, 13, 0.5); backdrop-filter: blur(8px); opacity: 0; transition: opacity 160ms; }
    #tour .veil[data-on] { opacity: 1; }
    #tour .scan { position: absolute; left: 0; right: 0; top: 0; height: 2px; background: #6f97ff; box-shadow: 0 0 18px 4px rgba(111, 151, 255, 0.55); opacity: 0; }
    #tour .scan[data-run] { animation: scan 560ms cubic-bezier(0.5, 0, 0.2, 1); }
    @keyframes scan { 0% { opacity: 1; transform: translateY(0); } 85% { opacity: 1; } 100% { opacity: 0; transform: translateY(100vh); } }
    #tour .cursor { position: absolute; left: 0; top: 0; width: 22px; height: 22px; margin: -4px 0 0 -4px; transform: translate(800px, 960px); transition: transform 620ms cubic-bezier(0.3, 0, 0.1, 1); filter: drop-shadow(0 2px 3px rgba(4, 6, 9, 0.5)); }
    #tour .ripple { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border: 2px solid #6f97ff; border-radius: 50%; animation: ripple 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes ripple { to { transform: scale(4.4); opacity: 0; } }
  `
  document.documentElement.appendChild(style)
  const root = document.createElement('div')
  root.id = 'tour'
  root.innerHTML = `
    <div class="veil"></div>
    <div class="scan"></div>
    <div class="hud"><span class="idx"></span><div><b></b><span></span></div></div>
    <svg class="cursor" viewBox="0 0 22 22"><path d="M4 3l13 6.2-5.4 1.9-1.9 5.4z" fill="#fff" stroke="#0d1013" stroke-width="1.6" stroke-linejoin="round"/></svg>`
  document.documentElement.appendChild(root)
  const $ = (selector) => root.querySelector(selector)
  window.tour = {
    start() { const bar = document.createElement('div'); bar.className = 'progress'; root.appendChild(bar) },
    hud(index, label, line) {
      const hud = $('.hud')
      hud.removeAttribute('data-on')
      if (!label) return
      setTimeout(() => { $('.hud .idx').textContent = index; $('.hud b').textContent = label; $('.hud span:last-child').textContent = line; hud.setAttribute('data-on', '') }, 220)
    },
    veil(on) { $('.veil').toggleAttribute('data-on', on); if (on) { const scan = $('.scan'); scan.removeAttribute('data-run'); void scan.offsetWidth; scan.setAttribute('data-run', '') } },
    cursor(x, y) { $('.cursor').style.transform = `translate(${x}px, ${y}px)` },
    ripple(x, y) { const ripple = document.createElement('div'); ripple.className = 'ripple'; ripple.style.left = `${x}px`; ripple.style.top = `${y}px`; root.appendChild(ripple); setTimeout(() => ripple.remove(), 700) },
  }
}

await record()

// Lossless frames become a 1600×900 animated WebP for the README and a 1080p constant-rate WebM for the full-resolution link.
execFileSync('python3', [resolve(import.meta.dirname, 'tour_webp.py'), work, join(out, 'aegis-tour.webp')], { stdio: 'inherit' })
// The WebM is encoded with the ffmpeg build Playwright already ships; it has libvpx but no filters or PNG input.
const cache = join(homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright')
const ffmpegDir = readdirSync(cache).filter((name) => name.startsWith('ffmpeg-')).sort().at(-1)
const ffmpeg = join(cache, ffmpegDir, readdirSync(join(cache, ffmpegDir)).find((name) => name.startsWith('ffmpeg')))
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', join(work, 'seq.mjpeg'), '-c:v', 'libvpx', '-b:v', '10M', '-crf', '4', '-qmin', '0', '-qmax', '20', '-auto-alt-ref', '0', '-pix_fmt', 'yuv420p', join(out, 'aegis-tour.webm')])
rmSync(work, { recursive: true, force: true })
console.log('wrote aegis-tour.webp and aegis-tour.webm in', out)

async function record() {
  // The new headless mode renders WebGL on the GPU; the default headless shell falls back to software and drops frames in 3D.
  const browser = await chromium.launch({ channel: 'chromium' })
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: scale })
  // Hide the dev indicator in every frame.
  await context.addInitScript(() => {
    // A constructed stylesheet is not a DOM node, so hydration cannot remove it.
    const sheet = new CSSStyleSheet()
    sheet.replaceSync('nextjs-portal { display: none !important; }')
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  })
  // Rehearse the whole tour first, in the same context, so every route is compiled and every tile on the camera path is cached.
  await perform(context, false)
  await perform(context, true)
  await context.close()
  await browser.close()
}

async function perform(context, capture) {
  const page = await context.newPage()
  const wait = (ms) => page.waitForTimeout(ms)
  const tour = (method, ...args) => page.evaluate(([name, values]) => window.tour[name](...values), [method, args])
  const idle = () => mapIdle(page)
  let began = 0
  const mark = (label) => capture && console.log(`${((Date.now() - began) / 1000).toFixed(1).padStart(5)} s  ${label}`)

  async function point(locator, { click = true, settle = 450 } = {}) {
    const target = async () => { const box = await locator.boundingBox(); return [box.x + Math.min(box.width / 2, 120), box.y + box.height / 2] }
    let [x, y] = await target()
    await tour('cursor', x, y)
    await wait(settle)
    if (!click) return
    // Measure again: the layout can still shift while the cursor travels.
    ;[x, y] = await target()
    await tour('cursor', x, y)
    await tour('ripple', x, y)
    await page.mouse.click(x, y)
  }
  // Wheel zoom in small steps reads as one continuous camera move, anchored where the cursor is.
  async function wheel(x, y, steps, delta) {
    await tour('cursor', x, y)
    await page.mouse.move(x, y)
    for (let step = 0; step < steps; step++) { await page.mouse.wheel(0, delta); await wait(50) }
    await idle()
  }
  async function go(navName, settle = async () => {}) {
    await tour('hud', null)
    await tour('veil', true)
    await wait(170)
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: navName, exact: true }).click()
    await page.waitForLoadState('networkidle')
    await settle()
    await wait(300)
    await tour('veil', false)
  }

  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await idle()
  await collapseLayers(page)
  await idle()
  await page.evaluate(overlay, length)
  const stats = await page.locator('.ui-summary').innerText()
  const figure = (label) => stats.match(new RegExp(`${label}\\n(\\d+)`, 'i'))?.[1]
  await wait(1200)

  // Playwright's recordVideo is a low-bitrate VP8 stream, so frames come straight from the compositor as PNGs instead.
  const cdp = await context.newCDPSession(page)
  const frames = [], writes = []
  if (capture) {
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
      const file = `f-${String(frames.length).padStart(5, '0')}.png`
      frames.push({ file, t: metadata.timestamp })
      writes.push(writeFile(join(work, file), Buffer.from(data, 'base64')))
    })
    await cdp.send('Page.startScreencast', { format: 'png', maxWidth: size.width * scale, maxHeight: size.height * scale, everyNthFrame: 1 })
  }
  began = Date.now()
  await tour('start')

  // 01 · The landing page is already live: push the camera in on the county core.
  mark('operating picture')
  await tour('hud', '01', 'Live operating picture', `${figure('Station network') || 39} stations · ${figure('Active incidents') || 5} active incidents · ${figure('Open alerts') || 15} open alerts`)
  const core = await page.locator('[data-map-station="fs-30"]').boundingBox()
  await tour('cursor', core.x + 40, core.y + 30)
  await wait(400)
  await wheel(core.x + 6, core.y + 6, 12, -130)
  await wait(700)

  // 02 · Tilt into 3D; columns rise with the units assigned to each station.
  mark('3D')
  await point(page.getByRole('button', { name: '3D view' }))
  await tour('hud', '02', 'Readiness in three dimensions', 'Column height is the number of units assigned to each station')
  await wait(1200)
  await idle()
  await wait(700)

  // 03 · Fly to one station: buildings, the 1-mile ring, and a live response link to an incident.
  // In the tilted view the marker can sit under the docked queue, so the cursor shows the move and the click goes to the marker itself.
  mark('station fly-in')
  await point(page.locator(`[data-map-station="${focusStation}"]`), { click: false })
  await page.locator(`[data-map-station="${focusStation}"]`).dispatchEvent('click')
  await tour('hud', '03', 'Drill into any station', 'Fly-in with distance rings and response links to active incidents')
  await wait(1450)
  await idle()
  const station = await page.locator(`[data-map-station="${focusStation}"]`).boundingBox()
  await wheel(station.x + 8, station.y + 8, 6, 120)
  await wait(1300)

  // 04 · Scrub the last 24 hours; the map and the attention queue follow the window.
  mark('scrubber')
  await point(page.getByRole('button', { name: 'Close station details' }), { settle: 300 })
  await page.evaluate(() => document.querySelector('[data-ui="time-track"]').scrollIntoView({ behavior: 'smooth', block: 'center' }))
  await wait(550)
  const track = await page.locator('[data-ui="time-track"]').boundingBox()
  await tour('hud', '04', 'Scrub the last 24 hours', 'The map and the queue filter to the window you draw')
  await tour('cursor', track.x + track.width * 0.55, track.y + 30)
  await wait(450)
  await page.mouse.move(track.x + track.width * 0.55, track.y + 30)
  await page.mouse.down()
  for (let step = 1; step <= 12; step++) {
    const x = track.x + track.width * (0.55 + 0.44 * step / 12)
    await tour('cursor', x, track.y + 30)
    await page.mouse.move(x, track.y + 30)
    await wait(45)
  }
  await page.mouse.up()
  await wait(1000)

  // 05 · One incident across the register, the map, and the relationship graph.
  mark('incidents')
  const register = page.locator('[data-ui="incident-register"] tbody tr').filter({ hasText: focusIncident }).locator('th button')
  await go('Incidents', () => register.waitFor())
  await tour('hud', '05', 'One record, every view', 'Register, map, and relationship graph share a single selection')
  await point(register, { settle: 420 })
  await wait(450)
  await point(page.getByRole('tab', { name: 'Map', exact: true }), { settle: 420 })
  await wait(1500)
  await idle()
  await wait(600)
  await point(page.getByRole('tab', { name: 'Graph', exact: true }), { settle: 420 })
  await wait(500)
  await point(page.locator('[data-ui="link-graph"]').first().locator('[data-graph-node="incident:inc-02"]'), { settle: 400 })
  await wait(1000)

  // 06 · Units: service history rebuilt from the audit trail.
  mark('units')
  await go('Units')
  await tour('hud', '06', 'Every apparatus, every state change', 'Deployment history rebuilt from the audit trail, not assumed')
  await point(page.locator('[data-ui="unit-row"]').nth(3), { settle: 400 })
  await wait(350)
  await point(page.getByRole('tab', { name: 'Deployment history', exact: true }), { settle: 400 })
  await wait(1400)

  // 07 · Command search across workspaces, stations, units, and incidents.
  mark('search')
  await tour('hud', '07', 'Search everything', 'Workspaces, stations, units, and active incidents from one box')
  await point(page.getByRole('button', { name: 'Search unit, station, incident, location' }), { settle: 400 })
  await wait(200)
  await page.keyboard.type('tysons', { delay: 65 })
  await wait(1100)
  await page.keyboard.press('Escape')

  // Back to the landing page, so the loop closes where it opened.
  mark('close')
  await go('County overview', async () => { await idle(); await collapseLayers(page); await idle() })
  await tour('hud', '—', 'Aegis Command', 'FastAPI · PostgreSQL · Kafka · Redis · Next.js · synthetic data')
  await wait(2000)
  mark('end')

  if (capture) {
    await cdp.send('Page.stopScreencast')
    await Promise.all(writes)
    writeFileSync(join(work, 'frames.json'), JSON.stringify({ frames, end: Date.now() / 1000 }))
  }
  await page.close()
}

// Resolves once MapLibre reports the camera still and every tile drawn (GeoMap sets data-map-idle).
async function mapIdle(page) {
  await page.waitForTimeout(250)
  await page.locator('[data-map-idle]').first().waitFor({ timeout: 20_000 })
}

// The layer panel starts open on wide screens; the tour shows the map without it.
async function collapseLayers(page) {
  const toggle = page.locator('[data-map] [aria-controls="map-layer-panel"]').first()
  if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click()
}
