import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const darkWorkspaces = [
  { path: '/', heading: 'Fairfax County readiness board', dataSelector: '#resource-posture tbody tr' },
  { path: '/readiness?view=incidents', heading: 'Incidents', dataSelector: '[data-ui="incident-row"], tbody tr' },
  { path: '/readiness', heading: 'Units', dataSelector: '[data-ui="unit-row"]' },
  { path: '/shifts', heading: 'Scheduling', dataSelector: '[data-ui="duty-row"]' },
  { path: '/certifications-management', heading: 'Credentials', dataSelector: 'tbody tr' },
  { path: '/analytics?view=overview&days=14', heading: 'Analytics', dataSelector: '.recharts-wrapper svg' },
]

test('theme toggle switches, persists across reloads, and is set before first paint', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await page.evaluate(() => localStorage.getItem('aegis-theme'))).toBe('light')

  // The boot script runs in <head>, so the theme is already applied when the document becomes interactive.
  await page.addInitScript(() => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') (window as typeof window & { earlyTheme?: string }).earlyTheme = document.documentElement.dataset.theme
    })
  })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible()
  expect(await page.evaluate(() => (window as typeof window & { earlyTheme?: string }).earlyTheme)).toBe('light')

  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('dialog').getByRole('button', { name: /Switch to dark theme/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('dark is the default even when the system prefers light', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light' })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await context.close()
})

for (const workspace of darkWorkspaces) {
  test(`${workspace.heading} meets contrast in the dark theme`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe runs once per workspace')
    await page.setViewportSize({ width: 1512, height: 1000 })
    await page.goto(workspace.path)
    await expect(page.getByRole('heading', { name: workspace.heading, level: 1 })).toBeVisible()
    await expect.poll(async () => page.locator(workspace.dataSelector).count(), { timeout: 15_000 }).toBeGreaterThan(0)
    await page.waitForTimeout(400)
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(accessibility.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? '')).map((violation) => ({ id: violation.id, nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')) }))).toEqual([])
  })
}
