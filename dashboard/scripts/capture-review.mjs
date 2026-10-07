// Local review capture: node scripts/capture-review.mjs <outDir> <route[@name]>... [--widths=1536x1024,390x844] [--full]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const outDir = args.shift()
const flags = args.filter((value) => value.startsWith('--'))
const routes = args.filter((value) => !value.startsWith('--'))
const widths = (flags.find((value) => value.startsWith('--widths='))?.split('=')[1] || '1536x1024').split(',').map((value) => value.split('x').map(Number))
const full = flags.includes('--full')
const base = process.env.REVIEW_BASE || 'http://127.0.0.1:3010'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
for (const [width, height] of widths) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await context.newPage()
  for (const entry of routes) {
    const split = entry.lastIndexOf('@')
    const route = split > 0 ? entry.slice(0, split) : entry
    const name = split > 0 ? entry.slice(split + 1) : route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const file = `${outDir}/${name}-${width}.png`
    await page.screenshot({ path: file, fullPage: full })
    console.log(file, overflow > 0 ? `HORIZONTAL OVERFLOW ${overflow}px` : 'ok')
  }
  await context.close()
}
await browser.close()
