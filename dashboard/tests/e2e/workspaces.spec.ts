import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const screenshotRoot = process.env.E2E_SCREENSHOT_DIR || "../pictures"

const workspaces = [
  { path: '/', heading: 'Fairfax County readiness board', dataSelector: '.resource-register tbody tr' },
  { path: '/readiness', heading: 'APPARATUS READINESS', dataSelector: '.sb-matrix tbody tr' },
  { path: '/personnel', heading: 'Workforce', dataSelector: '.person-list-row' },
  { path: '/shifts', heading: 'Scheduling', dataSelector: '.shift-list-row' },
  { path: '/certifications-management', heading: 'Credentials', dataSelector: 'tbody tr' },
  { path: '/analytics?view=overview&days=14', heading: 'Analytics', dataSelector: '.recharts-wrapper svg' },
  { path: '/weather', heading: 'Fairfax Weather Register', dataSelector: 'section[aria-label="Current weather readings"]' },
  { path: '/admin', heading: 'Access & Service Register', dataSelector: 'section[aria-label="Administration status"]' },
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

test('command wall and map controls work on desktop and mobile', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/')
  await expect(page.locator('.map-station')).toHaveCount(39)
  await expect(page.locator('.resource-register tbody tr').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('.map-station').first().click()
  await expect(page.locator('.map-detail')).toBeVisible()
  await page.getByRole('button', { name: 'Close station details' }).click()
  await page.getByRole('button', { name: 'RISK LAYERS', exact: true }).click()
  await expect(page.getByRole('button', { name: 'RISK LAYERS', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'INCIDENTS', exact: true }).click()
  await expect(page.getByRole('button', { name: 'INCIDENTS', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'RISK LAYERS', exact: true }).click()
  await page.getByRole('button', { name: 'INCIDENTS', exact: true }).click()
  await expect(page.getByRole('button', { name: 'INCIDENTS', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.locator('.topbar-connection strong').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await page.locator('.map-key').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(9)
  expect(await page.evaluate(() => document.querySelector('.dispatch-register tbody tr:last-child')!.getBoundingClientRect().bottom <= document.querySelector('.dispatch-register > footer')!.getBoundingClientRect().top)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= 1024 && document.documentElement.scrollWidth <= 1536)).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-command-desktop.png', fullPage: true, animations: 'disabled' })
  for (const width of [1920, 1600, 1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 })
    await expect(page.locator('h1')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    if (width === 1440) expect(await page.evaluate(() => document.querySelector('.dispatch-register tbody tr:last-child')!.getBoundingClientRect().bottom <= document.querySelector('.dispatch-register > footer')!.getBoundingClientRect().top)).toBe(true)
    if (browserName === 'chromium' && width === 1440) await page.screenshot({ path: '../.impeccable/review/desktop.png', fullPage: true, animations: 'disabled' })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.locator('.app-sidebar').evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
  expect(await page.evaluate(() => document.querySelector('.map-key')!.getBoundingClientRect().top >= document.querySelector('.tactical-map')!.getBoundingClientRect().bottom - 2)).toBe(true)
  expect(await page.evaluate(() => document.querySelector('.dispatch-register tbody td:last-child')!.getBoundingClientRect().right <= document.documentElement.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.querySelector('.resource-register table')!.getBoundingClientRect().right <= document.documentElement.clientWidth)).toBe(true)
  await expect(page.locator('.dispatch-register tbody tr').first().locator('[data-label="UNITS"]')).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-command-mobile.png', fullPage: true, animations: 'disabled' })

  await page.keyboard.press('Tab')
  await expect(page.locator(':focus-visible')).toBeVisible()
  expect(await page.emulateMedia({ reducedMotion: 'reduce' }).then(() => page.locator('.page-enter').evaluate((element) => getComputedStyle(element).animationName))).toBe('none')
})

test('mobile directory preserves navigation without covering the county board', async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Open navigation directory' })).toBeVisible()
    await expect(page.locator('.mobile-nav')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.getByRole('button', { name: 'Open navigation directory' }).click()
    const directory = page.getByRole('dialog', { name: 'SWITCHBOARD DIRECTORY' })
    await expect(directory).toBeVisible()
    await expect(directory.getByRole('link')).toHaveCount(12)
    await page.keyboard.press('Escape')
    await expect(directory).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Open navigation directory' })).toBeFocused()
  }
})

test('plotted incident theater links map, register, worksheet, lifecycle timeline, and posture', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/readiness?view=incidents')
  const rows = page.locator('.it-register tbody tr')
  await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(12)
  await page.getByLabel('Register view').selectOption('ACTIVE')
  await expect(rows).toHaveCount(5)
  await expect(page.locator('.incident-command-map .map-incident-marker')).toHaveCount(5)
  await rows.nth(1).locator('th button').click()
  await expect(page).toHaveURL(/incident=inc-03/)
  await expect(rows.nth(1)).toHaveClass(/is-selected/)
  await expect(page.locator('.it-f-location input')).toHaveValue(/Boone/)
  await expect(page.locator('.incident-command-map .map-incident-selected')).toHaveCount(1)
  await page.locator('.incident-command-map .map-incident-marker').first().focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/incident=/)
  await page.getByLabel('Search incidents').fill('no-such-incident')
  await expect(page.getByText('No incidents match this register view or search.')).toBeVisible()
  await page.getByLabel('Search incidents').clear()
  await page.getByLabel('Register view').selectOption('RECENT')
  await expect(rows).toHaveCount(7)
  await expect(rows.locator('.it-stamp')).toHaveText(Array(7).fill('CLOSED'))
  await page.getByLabel('Register view').selectOption('ALL')

  // Lifecycle timeline: recorded stages, type filter, unit activity, and event detail.
  await page.goto('/readiness?view=incidents&incident=inc-02')
  const fireRow = page.locator('.it-row-group').filter({ hasText: 'I-002' })
  await expect(fireRow.locator('.it-seg')).toHaveCount(3)
  await fireRow.locator('.it-seg').last().click()
  await expect(page.locator('.it-detail')).toContainText('ON SCENE')
  await expect(page.locator('.it-detail')).toContainText('recorded by')
  await page.locator('.it-types').getByLabel('Fire').uncheck()
  await expect(page.locator('.it-row-group').filter({ hasText: 'I-002' })).toHaveCount(0)
  await page.locator('.it-types').getByLabel('Fire').check()
  await page.getByLabel('Unit activity').check()
  await expect(page.locator('.it-row-group').filter({ hasText: 'I-002' }).locator('.it-unit-row')).toHaveCount(4)
  await page.getByLabel('Window length').selectOption('8')
  await expect(page.locator('.it-row-group').filter({ hasText: 'I-012' })).toHaveCount(0)
  await page.getByLabel('Window length').selectOption('12')
  await expect(page.locator('.it-row-group').filter({ hasText: 'I-012' })).toHaveCount(1)

  // Posture follows the selected incident and routes into the exact unit record.
  await expect(page.locator('.it-posture tbody tr:not(.is-other):not(.it-posture-divider)')).toHaveCount(4)
  await expect(page.locator('.it-posture-divider')).toHaveCount(1)
  await expect(page.locator('.it-posture tbody tr').first().locator('a')).toHaveAttribute('href', /view=units&unit=unit-/)
  await page.getByRole('tab', { name: 'STAFF' }).click()
  await expect.poll(() => page.locator('.it-posture tbody tr').count()).toBeGreaterThan(4)
  await page.getByRole('tab', { name: 'APPARATUS' }).click()
  await expect(page.getByRole('button', { name: 'RESOLVE INCIDENT' })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 1536)).toBe(true)
  await page.goto('/readiness?view=incidents')
  await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(12)
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-incidents-desktop.png', fullPage: true, animations: 'disabled' })
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.it-posture tbody tr').first()).toBeVisible()
  expect(await page.locator('.it-actions .button').first().evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-incidents-mobile.png', fullPage: true, animations: 'disabled' })
})

test('unit switchboard selects exact apparatus and reconstructs recorded activity', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/readiness?view=units')
  await expect(page.getByRole('heading', { name: 'STATION DEPLOYMENT MATRIX' })).toBeVisible()
  await expect.poll(() => page.locator('.sb-matrix tbody tr').count(), { timeout: 15_000 }).toBeGreaterThan(30)
  await expect(page.locator('#sb-dossier-heading')).toHaveText('ENGINE 421')
  await expect(page.locator('.sb-actions .button')).toHaveCount(4)
  await expect(page.locator('.sb-actions .button').first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'View history' })).toBeEnabled()

  // A cell with several apparatus opens an accessible chooser; the chosen unit drives URL, dossier, and timeline.
  const chooser = page.locator('.sb-unit-multi').first()
  await chooser.click()
  const options = page.getByRole('menuitem')
  await expect.poll(() => options.count()).toBeGreaterThan(1)
  const label = (await options.nth(1).locator('strong').textContent())!
  await options.nth(1).click()
  await expect(page).toHaveURL(/unit=/)
  await expect(page.locator('#sb-dossier-heading')).toContainText(label.replace(/^[A-Z]+(?=\d)/, '').toUpperCase())
  await expect(page.locator('.sb-row.is-selected')).toContainText(label)

  // Deep link into an out-of-service truck; history shows the recorded change and nothing before the watch baseline.
  await page.goto('/readiness?view=units&unit=unit-truck-06')
  await expect(page.locator('#sb-dossier-heading')).toHaveText('TRUCK 409')
  await expect(page.getByRole('button', { name: 'Return unit' })).toBeVisible()
  const truck = page.locator('.sb-row.is-selected')
  await expect(truck.locator('.sb-seg.tone-oos')).toHaveCount(1)
  await truck.locator('.sb-seg.tone-oos').click()
  await expect(page.locator('.sb-event-detail')).toContainText('Mechanical defect')
  await page.getByLabel('Window length').selectOption('24')
  await expect(truck.locator('.sb-seg.tone-unrecorded')).toHaveCount(1)
  await page.getByRole('button', { name: /^Focus T409/ }).click()
  await expect(page.locator('.sb-row')).toHaveCount(1)
  await page.getByRole('button', { name: /^Focus T409/ }).click()
  await page.locator('.sb-time-controls').getByLabel('Unit type').selectOption('MEDIC')
  await expect.poll(() => page.locator('.sb-row > span:nth-child(2)').allTextContents()).toEqual(expect.arrayContaining(['Medic']))
  expect((await page.locator('.sb-row > span:nth-child(2)').allTextContents()).every((type) => ['Medic', 'Ambulance'].includes(type))).toBe(true)

  await page.locator('.sb-search input').fill('no-such-station')
  await expect(page.getByText('No stations match the current filters.')).toBeVisible()
  await page.locator('.sb-search input').clear()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.goto('/readiness?view=units')
  await expect(page.locator('#sb-dossier-heading')).toHaveText('ENGINE 421')
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-units-desktop.png', fullPage: true, animations: 'disabled' })
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await expect(page.locator('.sb-matrix tbody tr').first().locator('[data-label="NOTES"]')).toBeVisible()
  }
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.locator('.sb-unit').first().evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-units-mobile.png', fullPage: true, animations: 'disabled' })
})

for (const workspace of workspaces) {
  test(`${workspace.heading} loads live data`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1512, height: 1000 })
    await expectHealthyWorkspace(page, workspace.path, workspace.heading, workspace.dataSelector)
    if (browserName === 'chromium') {
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(accessibility.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([])
    }
    if (workspace.path !== '/') {
      if (browserName === 'chromium') await page.screenshot({ path: `${screenshotRoot}/aegis-${workspace.path.split('?')[0].slice(1)}-desktop.png`, fullPage: true, animations: 'disabled' })
      await page.setViewportSize({ width: 390, height: 844 })
      await expect.poll(() => page.locator('.app-sidebar').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      if (browserName === 'chromium') await page.screenshot({ path: `${screenshotRoot}/aegis-${workspace.path.split('?')[0].slice(1)}-mobile.png`, fullPage: true, animations: 'disabled' })
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
  await expect(page.locator('.person-list-row')).toHaveCount(25, { timeout: 15_000 })
  const firstName = await page.locator('.person-list-row').first().textContent()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.person-list-row').first()).not.toHaveText(firstName!)
  await page.getByPlaceholder('Search name, role, or rank').fill('zzzz-no-person')
  await expect(page.getByRole('heading', { name: 'No personnel match' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Select a person' })).toBeVisible()
  await page.goto('/readiness?view=incidents')
  await expect(page.getByRole('heading', { name: 'County incident plot' })).toBeVisible()
  await expect(page.getByRole('button', { name: /open incident/i })).toBeDisabled()
})

test('command resources deep-link and handover brief downloads', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.dispatch-register tbody tr').first()).toBeVisible()
  await page.locator('.dispatch-register tbody tr a').first().click()
  await expect(page).toHaveURL(/readiness\?view=incidents/)
  await page.goto('/')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export duty officer brief' }).click()
  expect((await download).suggestedFilename()).toMatch(/^aegis-command-brief-.*\.md$/)
})

test('indexed rail resolves each destination to one active function', async ({ page }) => {
  const destinations = [
    ['/', '01'],
    ['/readiness?view=incidents', '02'],
    ['/readiness?view=units', '03'],
    ['/?layer=stations', '04'],
    ['/personnel', '05'],
    ['/?panel=resources#resource-posture', '06'],
    ['/readiness?view=simulation', '07'],
    ['/weather', '08'],
    ['/analytics', '09'],
    ['/admin', '10'],
  ] as const
  for (const [destination, index] of destinations) {
    await page.goto(destination)
    await expect(page.locator('.primary-nav [aria-current="page"]')).toHaveCount(1)
    await expect(page.locator('.primary-nav [aria-current="page"] .nav-index')).toHaveText(index)
    if (index === '04') {
      await expect(page.getByRole('button', { name: 'STATIONS', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByRole('button', { name: 'INCIDENTS', exact: true })).toHaveAttribute('aria-pressed', 'false')
    }
  }
})

test('a failed API has a visible recovery action', async ({ page }) => {
  await page.route('**/api/personnel', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary test outage' }) }))
  await page.goto('/personnel')
  await expect(page.getByText('Unable to load this data', { exact: true })).toBeVisible()
  await page.unroute('**/api/personnel')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.person-list-row')).toHaveCount(25, { timeout: 15_000 })
})
