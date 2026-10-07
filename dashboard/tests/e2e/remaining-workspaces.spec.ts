import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const screenshotRoot = process.env.E2E_SCREENSHOT_DIR || '../pictures'
const gallery: Record<string, string> = { '/readiness?view=simulation': 'plans', '/readiness?view=alerts': 'alerts', '/?layer=stations': 'stations' }
const routes = ['/personnel', '/shifts', '/certifications-management', '/analytics', '/readiness?view=simulation', '/readiness?view=alerts', '/?layer=stations', '/?panel=resources', '/weather', '/admin']

test('personnel station distribution, roster, and profile deep link agree', async ({ page }) => {
  await page.goto('/personnel')
  await page.locator('[data-ui="filters-toggle"]').click()
  const distribution = page.locator('[data-ui="station-distribution"] button')
  await expect(distribution).toHaveCount(39)
  await distribution.nth(1).click()
  await expect(page.getByLabel('Roster station')).toHaveValue('fs-02')
  await expect(page.locator('[data-ui="person-row"] [data-ui="person-station"]').first()).toHaveText('St. 2')
  await page.locator('[data-ui="person-row"]').nth(1).locator('th button').click()
  const name = await page.locator('[data-ui="person-row"][aria-selected="true"] th button').textContent()
  await expect(page.locator('#person-heading')).toHaveText(name!)
  await expect(page).toHaveURL(/person=/)
  await page.reload()
  await expect(page.locator('#person-heading')).toHaveText(name!)
  await expect(page.getByRole('button', { name: 'Edit profile' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Archive record' })).toBeDisabled()
})

test('duty timeline shows recorded apparatus groups, coverage, and overnight continuation', async ({ page }) => {
  await page.goto('/shifts')
  await expect.poll(() => page.locator('[data-ui="duty-row"]').count()).toBeGreaterThan(30)
  await expect(page.locator('[data-ui="duty-window"]').first()).toContainText('+1D')
  await page.locator('[data-ui="duty-row"]').first().click()
  await expect(page.locator('[data-ui="coverage-ledger"] tbody tr').first()).toBeVisible()
  await expect(page.locator('#shift-heading')).toHaveText('Fairfax County')
  await page.getByRole('button', { name: 'Next day', exact: true }).click()
  await expect(page.locator('[data-ui="duty-row"]').first()).toBeVisible()
  await expect(page.locator('[data-ui="duty-window"]').first()).toContainText('+1D')
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add to roster' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Cancel shift' })).toBeDisabled()
})

test('expiration bands filter risk and requirements stay linked to apparatus', async ({ page }) => {
  await page.goto('/certifications-management')
  await page.locator('[data-ui="horizon"] button').filter({ hasText: '0–14 days' }).click()
  await expect(page.getByRole('tab', { name: /Workforce risk/ })).toHaveAttribute('data-state', 'active')
  await expect(page.locator('[data-state="active"].ui-tab-content tbody tr')).toHaveCount(6)
  await page.locator('[data-ui="horizon"] button').filter({ hasText: /^Expired/ }).click()
  await expect(page.locator('[data-state="active"].ui-tab-content tbody tr')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Unit requirements' }).click()
  await expect.poll(() => page.locator('[data-ui="qualification-matrix"] tbody tr').count()).toBeGreaterThan(100)
  await expect(page.locator('[data-ui="qualification-matrix"] a').first()).toHaveAttribute('href', /view=units&unit=/)
  await page.getByRole('tab', { name: /Credential library/ }).click()
  await page.locator('[data-ui="credential-row"]').nth(1).click()
  await expect(page.locator('#credential-heading')).toHaveText((await page.locator('[data-ui="credential-row"]').nth(1).locator('strong').textContent())!)
  await expect(page.getByRole('button', { name: 'Delete unused' })).toBeDisabled()
})

test('analysis comparison selects station evidence and exports the current report', async ({ page }) => {
  await page.goto('/analytics')
  await expect(page.locator('[data-ui="station-comparison"]')).toHaveCount(39)
  await page.locator('[data-ui="station-comparison"]').first().click()
  await expect(page.locator('[data-ui="analysis-evidence"] h3')).toHaveText('Station 1 — McLean')
  await expect(page.locator('[data-ui="analysis-evidence"]')).toContainText('Staffing deficit')
  await expect(page.locator('[data-ui="analysis-evidence"] [data-ui="evidence-link"]').first()).toHaveAttribute('href', /view=units&unit=/)
  await page.getByRole('tab', { name: 'Staffing', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export current view' }).click()
  expect((await download).suggestedFilename()).toMatch(/^aegis-staffing-/)
})

test('contingency apparatus, crew, URL, reset, and read-only restrictions work', async ({ page }) => {
  await page.goto('/readiness?view=simulation')
  await expect(page.getByLabel('Scenario apparatus')).toBeVisible()
  await page.getByLabel('Scenario apparatus').selectOption('unit-engine-01')
  await expect(page).toHaveURL(/unit=unit-engine-01/)
  await expect(page).toHaveURL(/view=simulation/)
  await expect(page.locator('[data-ui="contingency"]')).toContainText('FF2')
  await page.getByLabel('Scenario disruption').selectOption('callout')
  await expect(page.getByLabel('Scenario crew member')).toBeVisible()
  await page.locator('[data-ui="scenario-crew"] button').nth(1).click()
  await expect(page.locator('[data-ui="scenario-crew"] button[aria-pressed="true"]')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Calculate scenario' })).toBeDisabled()
  await page.getByRole('button', { name: 'Reset scenario' }).click()
  await expect(page.getByLabel('Scenario disruption')).toHaveValue('offline')
  await expect(page.getByLabel('Scenario crew member')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Awaiting calculation' })).toBeVisible()
})

test('weather handles selection, missing readings, stale and unavailable reports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const now = new Date().toISOString()
  const fixture = { status: 'stale', available: true, stale: true, location: 'Fairfax County', message: 'Cached report', wind: { speed: '12 mph', direction: 'NW' }, source: { name: 'National Weather Service', url: 'https://weather.gov', source_updated_at: now, retrieved_at: now }, active_alerts: [], forecast_periods: [
    { number: 1, name: 'Today', start_time: now, temperature: 70, temperature_unit: 'F', wind_speed: '12 mph', wind_direction: 'NW', short_forecast: 'Sunny', detailed_forecast: 'Sunny forecast period.' },
    { number: 2, name: 'Tonight', start_time: now, temperature: null, temperature_unit: 'F', wind_speed: '5 mph', wind_direction: 'S', short_forecast: 'Cloudy', detailed_forecast: 'Cloudy forecast period.' },
  ] }
  await page.route('**/api/weather/fairfax', route => route.fulfill({ json: fixture }))
  await page.goto('/weather')
  await expect(page.locator('[data-ui="forecast"]')).toContainText('stale cached report')
  await expect(page.getByRole('status').filter({ hasText: 'stale cached report' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'National Weather Service' })).toHaveAttribute('href', 'https://weather.gov')
  await page.locator('[data-ui="forecast-periods"] button').nth(1).click()
  await expect(page.locator('[data-ui="forecast-selection"] h3')).toHaveText('Tonight')
  await expect(page.locator('[data-ui="forecast-selection"]')).toContainText('Wind from S')
  await expect(page.locator('[data-ui="forecast-periods"] button').nth(1).locator('strong')).toHaveText('—')
  expect(await page.locator('[data-ui="forecast-periods"] button').first().evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  await page.unroute('**/api/weather/fairfax')
  await page.route('**/api/weather/fairfax', route => route.fulfill({ json: { ...fixture, status: 'unavailable', available: false, stale: false, forecast_periods: [] } }))
  await page.reload()
  await expect(page.getByText('Temperature readings unavailable.', { exact: false })).toBeVisible()
  await expect(page.locator('[data-ui="forecast-periods"] button')).toHaveCount(0)
})

test('administration separates access, response checks, audit history, and demo maintenance', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Identity and permissions' })).toBeVisible()
  await page.getByRole('tab', { name: 'Response checks' }).click()
  await expect(page.locator('[data-ui="assurance-checks"] button')).toHaveCount(3)
  await page.locator('[data-ui="assurance-checks"] button').filter({ hasText: 'Recorded changes' }).click()
  await expect(page.locator('[data-ui="assurance-detail"] h3')).toHaveText('Recorded changes')
  await expect(page.locator('[data-ui="assurance"]')).toContainText('not performed')
  await page.getByRole('tab', { name: /Audit history/ }).click()
  await page.getByLabel('Audit record type').selectOption('incident')
  await expect(page.locator('[data-ui="audit-register"] tbody tr').first()).toBeVisible()
  await page.locator('[data-ui="audit-register"] tbody button').nth(1).click()
  await expect(page.locator('[data-ui="audit-detail"]')).toContainText('incident')
  await page.getByRole('tab', { name: 'Demo maintenance' }).click()
  await expect(page.getByRole('button', { name: 'Restore demo data' })).toBeDisabled()
})

test('workspaces fit all target widths and preserve accessible controls', async ({ page, browserName }) => {
  test.setTimeout(240_000)
  for (const path of routes) {
    await page.goto(path, { waitUntil: 'networkidle' })
    await expect(page.locator('h1')).toBeVisible()
    for (const width of [1920, 1600, 1536, 1440, 1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1024 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${path} at ${width}`).toBeLessThanOrEqual(0)
    }
    if (browserName === 'chromium') {
      for (const width of [1536, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 })
        await page.waitForTimeout(400) // let the inspector entrance settle before measuring contrast
        if (gallery[path]) await page.screenshot({ path: `${screenshotRoot}/aegis-${gallery[path]}-${width === 390 ? 'mobile' : 'desktop'}.png`, fullPage: true, animations: 'disabled' })
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
        expect(result.violations.filter(item => ['serious', 'critical'].includes(item.impact || '')), `${path} at ${width}`).toEqual([])
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/personnel')
  await expect(page.locator('[data-ui="person-row"]').first()).toBeVisible({ timeout: 15_000 })
  for (const selector of ['.ui-button', '.ui-search input', '.ui-disclosure > summary']) {
    expect(await page.locator(selector).first().evaluate(element => element.getBoundingClientRect().height), selector).toBeGreaterThanOrEqual(44)
  }
})
