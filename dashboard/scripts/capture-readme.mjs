// Captures the README gallery from the running application.
//   node scripts/capture-readme.mjs [name...]   (expects the dashboard at REVIEW_BASE, default http://127.0.0.1:3010)
// Writes ../pictures/readme/<name>.jpg: one viewport per shot, the same size for every page so the gallery grid lines up.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const base = process.env.REVIEW_BASE || 'http://127.0.0.1:3010'
const out = resolve(import.meta.dirname, '../../pictures/readme')
const size = { width: 1600, height: 1000 }
const only = process.argv.slice(2)
// Map shots are cropped to the map stage (and what it drives) so the map reads at half-width in the gallery.
const crops = {
  'map-3d': ['[data-map]'],
  'map-station': ['[data-map]'],
  'map-areas': ['[data-map]'],
  'map-scrubber': ['[data-map]', '[data-ui="time-track"]'],
  'incidents-map': ['[data-map]', 'aside.ui-inspector'],
}
mkdirSync(out, { recursive: true })

const shots = {
  // Map
  'overview': (page) => open(page, '/'),
  'map-3d': async (page) => {
    await open(page, '/'); await collapseLayers(page)
    // Close in on the county core before tilting, as the tour does.
    const core = await page.locator('[data-map-station="fs-30"]').boundingBox()
    await page.mouse.move(core.x + 6, core.y + 6)
    for (let step = 0; step < 5; step++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(60) }
    await mapIdle(page)
    await page.getByRole('button', { name: '3D view' }).click(); await mapIdle(page)
    await page.mouse.move(5, 500)
  },
  'map-station': async (page) => {
    await open(page, '/'); await collapseLayers(page)
    await page.getByRole('button', { name: '3D view' }).click(); await mapIdle(page)
    await page.locator('[data-map-station="fs-29"]').dispatchEvent('click'); await mapIdle(page)
    const station = await page.locator('[data-map-station="fs-29"]').boundingBox()
    await page.mouse.move(station.x + 8, station.y + 8)
    for (let step = 0; step < 7; step++) { await page.mouse.wheel(0, 110); await page.waitForTimeout(60) }
    await mapIdle(page)
    await page.mouse.move(5, 500)
  },
  'map-areas': async (page) => {
    await open(page, '/')
    for (const layer of ['Station areas', 'Risk layers']) await page.locator('[data-map] button[aria-pressed]', { hasText: layer }).first().click()
    await mapIdle(page)
  },
  'map-scrubber': async (page) => {
    await open(page, '/')
    // Bring the whole histogram into view with the map above it.
    await page.evaluate(() => { const box = document.querySelector('[data-ui="time-track"]').getBoundingClientRect(); window.scrollBy(0, box.bottom - window.innerHeight + 64) })
    const track = await page.locator('[data-ui="time-track"]').boundingBox()
    await page.mouse.move(track.x + track.width * 0.6, track.y + 30); await page.mouse.down()
    await page.mouse.move(track.x + track.width * 0.99, track.y + 30, { steps: 8 }); await page.mouse.up()
    await mapIdle(page)
  },
  'stations': (page) => open(page, '/?layer=stations&station=fs-29'),
  'incidents-map': (page) => open(page, '/readiness?view=incidents&incident=inc-02&pane=map'),
  'overview-light': (page) => open(page, '/'),
  // Operations
  'incidents': (page) => open(page, '/readiness?view=incidents&incident=inc-02'),
  'incident-timeline': (page) => open(page, '/readiness?view=incidents&incident=inc-02&pane=timeline'),
  'incident-graph': (page) => open(page, '/readiness?view=incidents&incident=inc-02&pane=graph'),
  'alerts': (page) => open(page, '/readiness?view=alerts'),
  'units': async (page) => { await open(page, '/readiness?view=units'); await page.locator('[data-ui="unit-row"]').nth(3).click(); await page.waitForTimeout(600) },
  'units-history': async (page) => { await open(page, '/readiness?view=units&pane=history'); await page.locator('[data-ui="unit-row"]').nth(3).click().catch(() => {}); await page.waitForTimeout(600) },
  // Workforce and analysis
  'shifts': (page) => open(page, '/shifts'),
  'personnel': (page) => open(page, '/personnel'),
  'credentials': (page) => open(page, '/certifications-management'),
  'analytics': (page) => open(page, '/analytics'),
  'plans': (page) => open(page, '/readiness?view=simulation'),
  'weather': (page) => open(page, '/weather'),
  'admin': async (page) => { await open(page, '/admin'); await page.getByRole('tab', { name: /Audit log/ }).click(); await page.waitForTimeout(800) },
}

// The new headless mode renders WebGL on the GPU, so map shots match what a browser shows.
const browser = await chromium.launch({ channel: 'chromium' })
for (const [name, shoot] of Object.entries(shots)) {
  if (only.length && !only.includes(name)) continue
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1.2, reducedMotion: 'reduce' })
  const theme = name.endsWith('-light') ? 'light' : 'dark'
  await context.addInitScript((value) => {
    try { localStorage.setItem('aegis-theme', value) } catch {}
    const sheet = new CSSStyleSheet()
    sheet.replaceSync('nextjs-portal { display: none !important; }')
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  }, theme)
  const page = await context.newPage()
  await shoot(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 90, clip: crops[name] && await union(page, crops[name]) })
  console.log(`${name}.jpg`)
  await context.close()
}
await browser.close()

// The smallest rectangle around every listed element, with room for the histogram's time axis below a track.
async function union(page, selectors) {
  const boxes = await Promise.all(selectors.map((selector) => page.locator(selector).first().boundingBox()))
  const x = Math.min(...boxes.map((box) => box.x)), y = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.width)), bottom = Math.max(...boxes.map((box) => box.y + box.height)) + (selectors.includes('[data-ui="time-track"]') ? 30 : 0)
  return { x, y, width: right - x, height: Math.min(bottom, size.height) - y }
}

async function open(page, route) {
  await page.goto(base + route, { waitUntil: 'networkidle' })
  await page.getByText('Operations connected').first().waitFor({ timeout: 15_000 }).catch(() => {})
  if (await page.locator('[data-map]').count()) await mapIdle(page)
  await page.waitForTimeout(900)
}

// Resolves once MapLibre reports the camera still and every tile drawn (GeoMap sets data-map-idle).
async function mapIdle(page) {
  await page.waitForTimeout(250)
  await page.locator('[data-map-idle]').first().waitFor({ timeout: 20_000 })
}

async function collapseLayers(page) {
  const toggle = page.locator('[data-map] [aria-controls="map-layer-panel"]').first()
  if (await toggle.getAttribute('aria-expanded') === 'true') { await toggle.click(); await mapIdle(page) }
}
