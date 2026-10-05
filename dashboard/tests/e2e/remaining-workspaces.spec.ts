import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const routes = ['/personnel', '/shifts', '/certifications-management', '/analytics', '/readiness?view=simulation', '/weather', '/admin']

test('personnel station register, fixed columns, and profile deep link agree', async ({ page }) => {
  await page.goto('/personnel')
  await expect(page.locator('.personnel-station-register button')).toHaveCount(39)
  await page.locator('.personnel-station-register button').nth(1).click()
  await expect(page.getByLabel('Roster station')).toHaveValue('fs-02')
  await expect(page.locator('.person-list-row .person-register-code').first()).toHaveText('ST. 2')
  await page.locator('.person-list-row').nth(1).click()
  const name = await page.locator('.person-list-row[aria-pressed="true"] strong').textContent()
  await expect(page.locator('.person-detail-heading h2')).toHaveText(name!)
  await expect(page).toHaveURL(/person=/)
  await page.reload()
  await expect(page.locator('.person-detail-heading h2')).toHaveText(name!)
  await expect(page.getByRole('button', { name: 'Edit profile' })).toBeDisabled()
})

test('duty board shows recorded apparatus groups, coverage, and overnight continuation', async ({ page }) => {
  await page.goto('/shifts')
  await expect.poll(() => page.locator('.duty-board-row').count()).toBeGreaterThan(30)
  await expect(page.locator('.duty-window').first()).toContainText('+1D')
  await page.locator('.duty-board-row').first().click()
  await expect(page.locator('.coverage-ledger tbody tr').first()).toBeVisible()
  await expect(page.locator('.shift-detail-heading h2')).toHaveText('Fairfax County')
  await page.getByRole('button', { name: 'Next day', exact: true }).click()
  await expect(page.locator('.duty-board-row').first()).toBeVisible()
  await expect(page.locator('.duty-window').first()).toContainText('+1D')
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add to roster' })).toBeDisabled()
})

test('expiration bands filter risk and requirements stay linked to apparatus', async ({ page }) => {
  await page.goto('/certifications-management')
  await page.locator('.expiration-horizon button').filter({ hasText: '0–14 days' }).click()
  await expect(page.getByRole('tab', { name: /Workforce risk/ })).toHaveAttribute('data-state', 'active')
  await expect(page.locator('[data-state="active"].tab-content tbody tr')).toHaveCount(6)
  await page.locator('.expiration-horizon button').filter({ hasText: /^Expired/ }).click()
  await expect(page.locator('[data-state="active"].tab-content tbody tr')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Unit requirements' }).click()
  await expect.poll(() => page.locator('.qualification-matrix tbody tr').count()).toBeGreaterThan(100)
  await expect(page.locator('.qualification-matrix a').first()).toHaveAttribute('href', /view=units&unit=/)
})

test('analysis comparison selects station evidence and exports the current report', async ({ page }) => {
  await page.goto('/analytics')
  await expect(page.locator('.station-comparison')).toHaveCount(39)
  await page.locator('.station-comparison').first().click()
  await expect(page.locator('.analysis-evidence h3')).toHaveText('Station 1 — McLean')
  await expect(page.locator('.analysis-evidence')).toContainText('Staffing deficit')
  await page.getByRole('tab', { name: 'Staffing', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export current view' }).click()
  expect((await download).suggestedFilename()).toMatch(/^aegis-staffing-/)
  await expect(page.locator('.analysis-evidence .evidence-link').first()).toHaveAttribute('href', /view=units&unit=/)
})

test('contingency apparatus, crew, URL, reset, and read-only restrictions work', async ({ page }) => {
  await page.goto('/readiness?view=simulation')
  await expect(page.getByLabel('Scenario apparatus')).toBeVisible()
  await page.getByLabel('Scenario apparatus').selectOption('unit-engine-01')
  await expect(page).toHaveURL(/unit=unit-engine-01/)
  await expect(page.locator('.contingency-layout')).toContainText('FF2')
  await page.getByLabel('Scenario disruption').selectOption('callout')
  await expect(page.getByLabel('Scenario crew member')).toBeVisible()
  await page.locator('.contingency-crew button').nth(1).click()
  await expect(page.locator('.contingency-crew button[aria-pressed="true"]')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Calculate scenario' })).toBeDisabled()
  await page.getByRole('button', { name: 'Reset scenario' }).click()
  await expect(page.getByLabel('Scenario disruption')).toHaveValue('offline')
  await expect(page.getByLabel('Scenario crew member')).toHaveCount(0)
})

test('weather instrument handles selection, missing readings, stale and unavailable reports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const now = new Date().toISOString()
  const fixture = { status: 'stale', available: true, stale: true, location: 'Fairfax County', message: 'Cached report', wind: { speed: '12 mph', direction: 'NW' }, source: { name: 'National Weather Service', url: 'https://weather.gov', source_updated_at: now, retrieved_at: now }, active_alerts: [], forecast_periods: [
    { number: 1, name: 'Today', start_time: now, temperature: 70, temperature_unit: 'F', wind_speed: '12 mph', wind_direction: 'NW', short_forecast: 'Sunny', detailed_forecast: 'Sunny forecast period.' },
    { number: 2, name: 'Tonight', start_time: now, temperature: null, temperature_unit: 'F', wind_speed: '5 mph', wind_direction: 'S', short_forecast: 'Cloudy', detailed_forecast: 'Cloudy forecast period.' },
  ] }
  await page.route('**/api/weather/fairfax', route => route.fulfill({ json: fixture }))
  await page.goto('/weather')
  await expect(page.locator('.forecast-console')).toContainText('stale cached report')
  for (const selector of ['.forecast-periods', '.forecast-selection h3', '.wind-instrument']) {
    expect(await page.locator(selector).evaluate(element => element.getBoundingClientRect().bottom), selector).toBeLessThanOrEqual(844)
  }
  await page.locator('.forecast-periods button').nth(1).click()
  await expect(page.locator('.forecast-selection h3')).toHaveText('Tonight')
  await expect(page.locator('.forecast-selection')).toContainText('Wind from S')
  await expect(page.locator('.forecast-periods button').nth(1).locator('strong')).toHaveText('—')
  await page.unroute('**/api/weather/fairfax')
  await page.route('**/api/weather/fairfax', route => route.fulfill({ json: { ...fixture, status: 'unavailable', available: false, stale: false, forecast_periods: [] } }))
  await page.reload()
  await expect(page.getByText('Temperature readings unavailable.', { exact: false })).toBeVisible()
  await expect(page.locator('.forecast-periods button')).toHaveCount(0)
})

test('assurance checks and audit selection expose only verified tenant responses', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.locator('.assurance-route button')).toHaveCount(3)
  await page.locator('.assurance-route button').filter({ hasText: 'Recorded changes' }).click()
  await expect(page.locator('.assurance-detail h3')).toHaveText('Recorded changes')
  await page.getByLabel('Audit record type').selectOption('incident')
  await expect(page.locator('.audit-register tbody tr').first()).toBeVisible()
  await page.locator('.audit-register tbody button').nth(1).click()
  await expect(page.locator('.audit-detail')).toContainText('incident')
  await expect(page.getByRole('button', { name: 'Restore demo data' })).toBeDisabled()
  await expect(page.locator('.assurance-topology')).toContainText('not performed')
})

test('remaining workspaces fit all target widths and preserve accessible controls', async ({ page, browserName }) => {
  test.setTimeout(180_000)
  for (const path of routes) {
    await page.goto(path, { waitUntil: 'networkidle' })
    await expect(page.locator('h1')).toBeVisible()
    for (const width of [1920, 1600, 1536, 1440, 1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1024 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${path} at ${width}`).toBeLessThanOrEqual(0)
    }
    if (browserName === 'chromium') {
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(result.violations.filter(item => ['serious', 'critical'].includes(item.impact || '')), path).toEqual([])
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await page.locator('.civic-workspace').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  }
})
