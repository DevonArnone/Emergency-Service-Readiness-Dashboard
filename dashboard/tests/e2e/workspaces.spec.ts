import { expect, test, type Page } from '@playwright/test'

const workspaces = [
  { path: '/', heading: 'Command Center', dataSelector: '.unit-summary-row' },
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
  await expect.poll(async () => page.locator(dataSelector).count()).toBeGreaterThan(0)

  expect(Date.now() - startedAt).toBeLessThan(10_000)
  expect(await page.locator('text=missing required error components').count()).toBe(0)
  expect(await page.getByText('Unable to load this data', { exact: true }).count()).toBe(0)
  expect(await page.getByText('This workspace could not load', { exact: true }).count()).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(consoleErrors).toEqual([])
}

for (const workspace of workspaces) {
  test(`${workspace.heading} loads live data`, async ({ page }) => {
    await expectHealthyWorkspace(page, workspace.path, workspace.heading, workspace.dataSelector)
  })
}

test('analytics controls preserve view and period in the URL', async ({ page }) => {
  await page.goto('/analytics?view=overview&days=14')
  await expect.poll(async () => page.locator('.recharts-wrapper svg').count()).toBeGreaterThan(0)
  await page.getByRole('button', { name: '30 days', exact: true }).click()
  await expect(page).toHaveURL(/days=30/)
  await page.getByRole('tab', { name: 'Staffing', exact: true }).click()

  await expect(page).toHaveURL(/view=staffing/)
  expect(new URL(page.url()).searchParams.get('days')).toBe('30')
  await expect.poll(async () => page.locator('tbody tr').count()).toBeGreaterThan(0)
})
