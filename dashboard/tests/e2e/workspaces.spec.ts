import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const screenshotRoot = process.env.E2E_SCREENSHOT_DIR || "../pictures"

const workspaces = [
  { path: '/', heading: 'Fairfax County readiness board', dataSelector: '#resource-posture tbody tr' },
  { path: '/readiness', heading: 'Units', dataSelector: '[data-ui="unit-row"]' },
  { path: '/personnel', heading: 'Personnel', dataSelector: '[data-ui="person-row"]' },
  { path: '/shifts', heading: 'Scheduling', dataSelector: '[data-ui="shift-row"]' },
  { path: '/certifications-management', heading: 'Credentials', dataSelector: 'tbody tr' },
  { path: '/analytics?view=overview&days=14', heading: 'Analytics', dataSelector: '.recharts-wrapper svg' },
  { path: '/weather', heading: 'Weather', dataSelector: '[aria-label="Current weather readings"]' },
  { path: '/admin', heading: 'Administration', dataSelector: '[aria-label="Administration status"]' },
]

const fits = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

async function expectHealthyWorkspace(page: Page, path: string, heading: string, dataSelector: string) {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  const startedAt = Date.now()
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  await expect.poll(async () => page.locator(dataSelector).count(), { timeout: 15_000 }).toBeGreaterThan(0)

  expect(Date.now() - startedAt).toBeLessThan(10_000)
  expect(await page.locator('text=missing required error components').count()).toBe(0)
  expect(await page.getByText('Unable to load this data', { exact: true }).count()).toBe(0)
  expect(await page.getByText('This workspace could not load', { exact: true }).count()).toBe(0)
  expect(await fits(page)).toBe(true)
  expect(consoleErrors).toEqual([])
}

test('county overview map, layers, and station inspector work on desktop and mobile', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/')
  await expect(page.locator('[data-map-station]')).toHaveCount(39)
  await expect(page.locator('#resource-posture tbody tr').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('[data-map-station]').first().click()
  const inspector = page.getByRole('complementary', { name: 'Station details' })
  await expect(inspector).toBeVisible()
  await expect(inspector.getByRole('link', { name: 'Open station units' })).toHaveAttribute('href', /view=units/)
  await page.getByRole('button', { name: 'Close station details' }).click()
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible()
  await page.getByRole('button', { name: 'Risk layers', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Risk layers', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Incidents', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Incidents', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('[data-map-incident]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Risk layers', exact: true }).click()
  await page.getByRole('button', { name: 'Incidents', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Incidents', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await page.getByRole('button', { name: 'Reset map view' }).click()
  await expect(page.getByText('Operations connected')).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-command-desktop.png', fullPage: true, animations: 'disabled' })
  for (const width of [1920, 1600, 1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 })
    await expect(page.locator('h1')).toBeVisible()
    expect(await fits(page), `overview at ${width}`).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('[data-shell="rail"]')).toBeHidden()
  await expect(page.locator('[data-ui="incident-queue"] a').first()).toBeVisible()
  // Below 1280px the station inspector is a drawer that returns to the page when closed.
  await page.locator('[data-map-station]').first().click()
  const drawer = page.getByRole('dialog', { name: 'Station details' })
  await expect(drawer).toBeVisible()
  expect(await drawer.getByRole('link', { name: 'Open station units' }).evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await page.evaluate(() => window.scrollTo(0, 0))
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-command-mobile.png', fullPage: true, animations: 'disabled' })

  await page.keyboard.press('Tab')
  await expect(page.locator(':focus-visible')).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('.ui-button').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(0.001)
})

test('mobile navigation drawer lists every workspace and returns focus', async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
    expect(await fits(page)).toBe(true)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const directory = page.getByRole('dialog', { name: 'Navigation' })
    await expect(directory).toBeVisible()
    await expect(directory.getByRole('navigation').getByRole('link')).toHaveCount(13)
    await page.keyboard.press('Escape')
    await expect(directory).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused()
  }
})

test('command search groups workspaces, stations, units, and incidents', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-map-station]')).toHaveCount(39)
  await page.keyboard.press('ControlOrMeta+k')
  const search = page.getByRole('dialog', { name: 'Search Aegis Command' })
  await expect(search).toBeVisible()
  await search.getByLabel('Search workspaces and actions').fill('E421')
  await expect(search.getByRole('region', { name: 'Units' }).getByRole('button')).toHaveCount(1)
  await search.getByLabel('Search workspaces and actions').fill('Fair Oaks')
  await expect(search.getByRole('region', { name: 'Stations' }).getByRole('button').first()).toBeVisible()
  await expect(search.getByRole('region', { name: 'Incidents' }).getByRole('button').first()).toBeVisible()
  await search.getByLabel('Search workspaces and actions').fill('Scheduling')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/shifts/)
})

test('incident register, map, worksheet, lifecycle timeline, and posture share one selection', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/readiness?view=incidents')
  const rows = page.locator('[data-ui="incident-register"] tbody tr')
  const pane = (name: string) => page.getByRole('tablist', { name: 'Incident views' }).getByRole('tab', { name, exact: true })
  await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(12)
  await page.getByLabel('Register view').selectOption('ACTIVE')
  await expect(rows).toHaveCount(5)
  await pane('Map').click()
  await expect(page).toHaveURL(/pane=map/)
  await expect(page.getByRole('heading', { name: 'County incident plot' })).toBeVisible()
  await expect(page.locator('[data-map-incident]')).toHaveCount(5)
  await pane('Register').click()
  await rows.nth(1).locator('th button').click()
  await expect(page).toHaveURL(/incident=inc-03/)
  await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-ui="incident-location"]')).toHaveValue(/Boone/)
  await pane('Map').click()
  await expect(page.locator('[data-map-incident][data-selected]')).toHaveCount(1)
  await page.locator('[data-map-incident]').first().focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/incident=/)
  await pane('Register').click()
  await page.getByLabel('Search incidents').fill('no-such-incident')
  await expect(page.getByText('No incidents match this register view or search.')).toBeVisible()
  await page.getByLabel('Search incidents').clear()
  await page.getByLabel('Register view').selectOption('RECENT')
  await expect(rows).toHaveCount(7)
  await expect(rows.locator('[data-ui="incident-status"]')).toHaveText(Array(7).fill('Closed'))
  await page.getByLabel('Register view').selectOption('ALL')

  // Lifecycle timeline: recorded stages, type filter, unit activity, and event detail. A reload keeps view and selection.
  await page.goto('/readiness?view=incidents&pane=timeline&incident=inc-02')
  const group = (ref: string) => page.locator(`[data-ui="timeline-group"][data-incident="${ref}"]`)
  await expect(group('I-002').locator('[data-ui="timeline-stage"]')).toHaveCount(3)
  await expect(group('I-002')).toHaveAttribute('data-selected', 'true')
  await group('I-002').locator('[data-ui="timeline-stage"]').last().click()
  await expect(page.locator('[data-ui="timeline-detail"]')).toContainText('ON SCENE')
  await expect(page.locator('[data-ui="timeline-detail"]')).toContainText('recorded by')
  await page.locator('[data-ui="timeline-types"]').getByLabel('Fire').uncheck()
  await expect(group('I-002')).toHaveCount(0)
  await page.locator('[data-ui="timeline-types"]').getByLabel('Fire').check()
  await page.getByLabel('Unit activity').check()
  await expect(group('I-002').locator('[data-ui="timeline-unit-row"]')).toHaveCount(4)
  await page.getByLabel('Window length').selectOption('8')
  await expect(group('I-012')).toHaveCount(0)
  await page.getByLabel('Window length').selectOption('12')
  await expect(group('I-012')).toHaveCount(1)

  // Posture follows the selected incident and routes into the exact unit record.
  const posture = page.locator('[data-ui="posture"] tbody tr')
  await expect(page.locator('[data-ui="posture"] tbody tr:not([data-other]):not([data-ui="posture-divider"])')).toHaveCount(4)
  await expect(page.locator('[data-ui="posture-divider"]')).toHaveCount(1)
  await expect(posture.first().locator('a')).toHaveAttribute('href', /view=units&unit=unit-/)
  await page.getByRole('tab', { name: 'Staff', exact: true }).click()
  await expect.poll(() => posture.count()).toBeGreaterThan(4)
  await page.getByRole('tab', { name: 'Apparatus', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resolve incident' })).toBeDisabled()
  await page.goBack()
  await expect(page).toHaveURL(/readiness/)
  expect(await fits(page)).toBe(true)
  await page.goto('/readiness?view=incidents')
  await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(12)
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-incidents-desktop.png', fullPage: true, animations: 'disabled' })
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await fits(page), `incidents at ${width}`).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-incidents-mobile.png', fullPage: true, animations: 'disabled' })
  await rows.first().locator('th button').click()
  const drawer = page.getByRole('dialog', { name: 'Incident record' })
  await expect(drawer).toBeVisible()
  expect(await drawer.locator('[data-ui="incident-actions"] .ui-button').first().evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  await drawer.getByRole('button', { name: 'Close details' }).click()
  await expect(drawer).toBeHidden()
})

test('unit register, coverage matrix, and deployment history select exact apparatus', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/readiness?view=units')
  const pane = (name: string) => page.getByRole('tablist', { name: 'Unit views' }).getByRole('tab', { name, exact: true })
  await expect.poll(() => page.locator('[data-ui="unit-row"]').count(), { timeout: 15_000 }).toBeGreaterThan(100)
  await expect(page.locator('#unit-record-heading')).toHaveText('Engine 421')
  await expect(page.locator('[data-ui="unit-actions"] .ui-button')).toHaveCount(4)
  await expect(page.locator('[data-ui="unit-actions"] .ui-button').first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'View history' })).toBeEnabled()

  // A matrix cell with several apparatus opens an accessible chooser; the chosen unit drives URL and record.
  await pane('Coverage matrix').click()
  await expect(page).toHaveURL(/pane=matrix/)
  await expect.poll(() => page.locator('[data-ui="unit-matrix"] tbody tr').count()).toBeGreaterThan(30)
  await page.locator('[data-ui="unit-chip-multi"]').first().click()
  const options = page.getByRole('menuitem')
  await expect.poll(() => options.count()).toBeGreaterThan(1)
  const label = (await options.nth(1).locator('strong').textContent())!
  await options.nth(1).click()
  await expect(page).toHaveURL(/unit=/)
  await expect(page.locator('#unit-record-heading')).toContainText(label.replace(/^[A-Z]+(?=\d)/, ''))
  await expect(page.locator('[data-ui="station-note"]').first()).toBeVisible()

  // Deep link into an out-of-service truck; history shows the recorded change and nothing before the watch baseline.
  await page.goto('/readiness?view=units&pane=history&unit=unit-truck-06')
  await expect(page.locator('#unit-record-heading')).toHaveText('Truck 409')
  await expect(page.getByRole('button', { name: 'Return unit' })).toBeVisible()
  const truck = page.locator('[data-ui="unit-history-row"][data-selected]')
  await expect(truck.locator('[data-ui="unit-bar"][data-tone="oos"]')).toHaveCount(1)
  await truck.locator('[data-ui="unit-bar"][data-tone="oos"]').click()
  await expect(page.locator('[data-ui="unit-event-detail"]')).toContainText('Mechanical defect')
  await page.getByLabel('Window length').selectOption('24')
  await expect(truck.locator('[data-ui="unit-bar"][data-tone="unrecorded"]')).toHaveCount(1)
  await page.getByRole('button', { name: /^Focus T409/ }).click()
  await expect(page.locator('[data-ui="unit-history-row"]')).toHaveCount(1)
  await page.getByRole('button', { name: /^Focus T409/ }).click()
  await page.locator('[data-ui="unit-time-controls"]').getByLabel('Unit type').selectOption('MEDIC')
  await expect.poll(() => page.locator('[data-ui="unit-history-type"]').allTextContents()).toEqual(expect.arrayContaining(['Medic']))
  expect((await page.locator('[data-ui="unit-history-type"]').allTextContents()).every((type) => ['Medic', 'Ambulance'].includes(type))).toBe(true)

  await pane('Register').click()
  await page.locator('[data-ui="unit-search"]').fill('no-such-station')
  await expect(page.getByText('No stations match the current filters.')).toBeVisible()
  await page.locator('[data-ui="unit-search"]').clear()
  expect(await fits(page)).toBe(true)
  await page.goto('/readiness?view=units')
  await expect(page.locator('#unit-record-heading')).toHaveText('Engine 421')
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-units-desktop.png', animations: 'disabled' })
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await fits(page), `units at ${width}`).toBe(true)
    await expect(page.locator('[data-ui="unit-row"]').first()).toBeVisible()
  }
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.locator('[data-ui="unit-row"]').first().evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  if (browserName === 'chromium') await page.screenshot({ path: screenshotRoot + '/aegis-units-mobile.png', animations: 'disabled' })
})

test('alert queue filters by state and opens record context', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/readiness?view=alerts')
  const rows = page.locator('[data-ui="alert-queue"] tbody tr')
  await expect.poll(() => rows.count(), { timeout: 15_000 }).toBeGreaterThan(5)
  await rows.nth(2).locator('th button').click()
  await expect(page).toHaveURL(/alert=/)
  const inspector = page.getByRole('complementary', { name: 'Alert record' })
  await expect(inspector).toContainText('Audit trail')
  await expect(inspector.getByRole('button', { name: 'Acknowledge' })).toBeDisabled()
  await expect(inspector.getByRole('button', { name: 'Resolve' })).toBeDisabled()
  await page.getByRole('group', { name: 'Alert state' }).getByRole('button', { name: 'Resolved' }).click()
  await expect(rows).toHaveCount(0)
  await page.getByRole('group', { name: 'Alert state' }).getByRole('button', { name: 'All' }).click()
  await expect.poll(() => rows.count()).toBeGreaterThan(5)
})

for (const workspace of workspaces) {
  test(`${workspace.heading} loads live data`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1512, height: 1000 })
    await expectHealthyWorkspace(page, workspace.path, workspace.heading, workspace.dataSelector)
    if (browserName === 'chromium') {
      await page.waitForTimeout(400) // let the inspector entrance settle before measuring contrast
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(accessibility.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([])
    }
    if (workspace.path !== '/' && workspace.path !== '/readiness') {
      if (browserName === 'chromium') await page.screenshot({ path: `${screenshotRoot}/aegis-${workspace.path.split('?')[0].slice(1)}-desktop.png`, fullPage: true, animations: 'disabled' })
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(page.locator('[data-shell="rail"]')).toBeHidden()
      expect(await fits(page)).toBe(true)
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
  await page.getByText('Staffing exceptions', { exact: true }).click()
  await expect(page.getByRole('region', { name: 'Staffing exceptions' }).locator('tbody tr').first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Staffing', exact: true })).toHaveAttribute('data-state', 'active')
  await expect(page.getByRole('button', { name: '30 days', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('read-only controls, pagination, and empty filters are complete', async ({ page }) => {
  await page.goto('/personnel')
  await expect(page.getByRole('button', { name: 'Add personnel', exact: true })).toBeDisabled()
  await expect(page.locator('[data-ui="person-row"]')).toHaveCount(25, { timeout: 15_000 })
  const firstName = await page.locator('[data-ui="person-row"]').first().textContent()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('[data-ui="person-row"]').first()).not.toHaveText(firstName!)
  await page.getByPlaceholder('Search name, role, or rank').fill('zzzz-no-person')
  await expect(page.getByRole('heading', { name: 'No personnel match' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Select a person' })).toBeVisible()
  await page.goto('/readiness?view=incidents&pane=map')
  await expect(page.getByRole('heading', { name: 'County incident plot' })).toBeVisible()
  await expect(page.getByRole('button', { name: /open incident/i })).toBeDisabled()
})

test('overview incidents deep-link and the handover brief downloads', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-ui="incident-queue"] a').first()).toBeVisible()
  await page.locator('[data-ui="incident-queue"] a').first().click()
  await expect(page).toHaveURL(/readiness\?view=incidents&incident=/)
  await page.goto('/')
  await expect(page.locator('#resource-posture tbody tr').first()).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export duty officer brief' }).click()
  expect((await download).suggestedFilename()).toMatch(/^aegis-command-brief-.*\.md$/)
})

test('navigation resolves each destination to one active item', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const destinations = [
    ['/', 'County overview'],
    ['/readiness?view=incidents', 'Incidents'],
    ['/readiness?view=units', 'Units'],
    ['/readiness?view=alerts', 'Alerts'],
    ['/?layer=stations', 'Stations'],
    ['/personnel', 'Personnel'],
    ['/shifts', 'Scheduling'],
    ['/certifications-management', 'Credentials'],
    ['/?panel=resources#resource-posture', 'Resource status'],
    ['/readiness?view=simulation', 'Plans & Hazards'],
    ['/weather', 'Weather'],
    ['/analytics', 'Analytics'],
    ['/admin', 'Admin'],
  ] as const
  const active = page.getByRole('navigation', { name: 'Primary navigation' }).locator('[aria-current="page"]')
  for (const [destination, name] of destinations) {
    await page.goto(destination)
    await expect(active).toHaveCount(1)
    await expect(active).toContainText(name)
    if (name === 'Stations') {
      await expect(page.getByRole('button', { name: 'Stations', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByRole('button', { name: 'Incidents', exact: true })).toHaveAttribute('aria-pressed', 'false')
    }
    if (name === 'Resource status') await expect(page.getByRole('tab', { name: 'Apparatus' })).toHaveAttribute('data-state', 'active')
  }
  await page.goto('/certifications')
  await expect(page).toHaveURL(/certifications-management/)
})

test('station directory, map, and inspector stay linked and keep the selection on reload', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/?layer=stations')
  const rows = page.getByRole('region', { name: 'Station directory' }).locator('tbody tr')
  await expect(rows).toHaveCount(39, { timeout: 15_000 })
  await page.getByLabel('Search stations').fill('Fair Oaks')
  await expect(rows).toHaveCount(1)
  await rows.first().locator('th button').click()
  await expect(page).toHaveURL(/station=fs-21/)
  await expect(page.locator('[data-map-station="fs-21"]')).toHaveAttribute('data-selected', 'true')
  const inspector = page.getByRole('complementary', { name: 'Station details' })
  await expect(inspector.getByRole('heading', { name: 'Fair Oaks' })).toBeVisible()
  await page.reload()
  await expect(inspector.getByRole('heading', { name: 'Fair Oaks' })).toBeVisible()
  await inspector.getByRole('link', { name: 'Open station personnel' }).click()
  await expect(page).toHaveURL(/\/personnel/)
  await expect(page.getByLabel('Station scope')).toHaveValue('fs-21')
})

test('a failed API has a visible recovery action', async ({ page }) => {
  await page.route('**/api/personnel', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary test outage' }) }))
  await page.goto('/personnel')
  await expect(page.getByText('Unable to load this data', { exact: true })).toBeVisible()
  await page.unroute('**/api/personnel')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('[data-ui="person-row"]')).toHaveCount(25, { timeout: 15_000 })
})

test('unknown routes show the not-found state inside the shell', async ({ page }) => {
  await page.goto('/no-such-workspace')
  await expect(page.getByRole('heading', { name: 'Workspace not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Return to county overview' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fairfax County readiness board' })).toBeVisible()
})
