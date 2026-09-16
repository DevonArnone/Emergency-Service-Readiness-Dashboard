import { expect, test, type Page } from '@playwright/test'

const workspaces = [
  { path: '/', heading: 'Every resource. One clear picture.', dataSelector: '.resource-tile' },
  { path: '/readiness', heading: 'Operations', dataSelector: '.unit-list-row' },
  { path: '/personnel', heading: 'Workforce', dataSelector: '.person-list-row' },
  { path: '/shifts', heading: 'Scheduling', dataSelector: '.shift-list-row' },
  { path: '/certifications-management', heading: 'Credentials', dataSelector: 'tbody tr' },
  { path: '/analytics?view=overview&days=14', heading: 'Analytics', dataSelector: '.recharts-wrapper svg' },
]

async function expectHealthyWorkspace(page: Page, path: string, heading: string, dataSelector: string) {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  const startedAt = Date.now()
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  await expect.poll(async () => page.locator(dataSelector).count(), { timeout: 15_000 }).toBeGreaterThan(0)

  expect(Date.now() - startedAt).toBeLessThan(20_000)
  expect(await page.locator('text=missing required error components').count()).toBe(0)
  expect(await page.getByText('Unable to load this data', { exact: true }).count()).toBe(0)
  expect(await page.getByText('This workspace could not load', { exact: true }).count()).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(consoleErrors).toEqual([])
}

test('command map and filters work on desktop and mobile', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1512, height: 1100 })
  await page.goto('/')
  await expect(page.locator('.map-station')).toHaveCount(39)
  await expect(page.locator('.resource-tile').first()).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /Station 1 — McLean/ }).click()
  await expect(page.locator('.map-detail')).toContainText('McLean')
  await page.getByRole('button', { name: 'Close station details' }).click()
  await page.getByRole('button', { name: /Needs attention/ }).click()
  await expect(page.locator('.resource-tile:not(.resource-attention)')).toHaveCount(0)
  await page.getByRole('button', { name: 'All units', exact: true }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  if (browserName === 'chromium') await page.screenshot({ path: '../pictures/aegis-command-desktop.png', fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('h1')).toBeVisible()
  await expect.poll(() => page.locator('.app-sidebar').evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  if (browserName === 'chromium') await page.screenshot({ path: '../pictures/aegis-command-mobile.png', fullPage: true, animations: 'disabled' })
})

for (const workspace of workspaces) {
  test(`${workspace.heading} loads live data`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1512, height: 1000 })
    await expectHealthyWorkspace(page, workspace.path, workspace.heading, workspace.dataSelector)
    if (workspace.path !== '/') {
      if (browserName === 'chromium') await page.screenshot({ path: `../pictures/aegis-${workspace.path.split('?')[0].slice(1)}-desktop.png`, fullPage: true, animations: 'disabled' })
      await page.setViewportSize({ width: 390, height: 844 })
      await expect.poll(() => page.locator('.app-sidebar').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      if (browserName === 'chromium') await page.screenshot({ path: `../pictures/aegis-${workspace.path.split('?')[0].slice(1)}-mobile.png`, fullPage: true, animations: 'disabled' })
    }
  })
}

test('analytics controls preserve view and period in the URL', async ({ page }) => {
  await page.goto('/analytics?view=overview&days=14')
  await expect.poll(async () => page.locator('.recharts-wrapper svg').count(), { timeout: 15_000 }).toBeGreaterThan(0)
  await page.getByRole('button', { name: '30 days', exact: true }).click()
  await expect(page).toHaveURL(/days=30/)
  await page.getByRole('tab', { name: 'Staffing', exact: true }).click()

  await expect(page).toHaveURL(/view=staffing/)
  expect(new URL(page.url()).searchParams.get('days')).toBe('30')
  await expect.poll(async () => page.locator('tbody tr').count()).toBeGreaterThan(0)
})

test('read-only controls, pagination, and empty filters are complete', async ({ page }) => {
  await page.goto('/personnel')
  await expect(page.getByRole('button', { name: 'Add personnel', exact: true })).toBeDisabled()
  await expect(page.locator('.person-list-row')).toHaveCount(25)
  const firstName = await page.locator('.person-list-row').first().textContent()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.person-list-row').first()).not.toHaveText(firstName!)
  await page.getByPlaceholder('Search name, role, or rank').fill('zzzz-no-person')
  await expect(page.getByRole('heading', { name: 'No personnel match' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Select a person' })).toBeVisible()
  await page.goto('/readiness?view=incidents')
  await expect(page.getByRole('tab', { name: /Incidents/ })).toHaveAttribute('data-state', 'active')
  await expect(page.getByRole('button', { name: 'Open incident', exact: true }).first()).toBeDisabled()
})

test('command resources deep-link and handover brief downloads', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.resource-tile').first()).toBeVisible()
  const destination = await page.locator('.resource-tile').nth(1).getAttribute('href')
  await page.locator('.resource-tile').nth(1).click()
  await expect(page).toHaveURL(new RegExp(destination!.replace('?', '\\?')))
  await expect(page.locator('.unit-list-row-active')).toHaveCount(1)
  await page.goto('/')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export handover brief' }).click()
  expect((await download).suggestedFilename()).toMatch(/^aegis-handover-.*\.md$/)
})

test('a failed API has a visible recovery action', async ({ page }) => {
  await page.route('**/api/personnel', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary test outage' }) }))
  await page.goto('/personnel')
  await expect(page.getByText('Unable to load this data', { exact: true })).toBeVisible()
  await page.unroute('**/api/personnel')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.person-list-row')).toHaveCount(25)
})
