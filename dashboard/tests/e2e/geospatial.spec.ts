import { expect, test } from '@playwright/test'

test('map layer panel, 3D view, and selection rings respond on the county overview', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/')
  await expect(page.locator('[data-map-station]')).toHaveCount(39, { timeout: 15_000 })
  const map = page.locator('[data-map="readiness"]')

  // Docked layouts open the full layer list; toggling a layer there updates its pressed state.
  const panel = page.getByRole('group', { name: 'All map layers' })
  await expect(panel.getByRole('button', { name: 'Incidents', exact: true })).toHaveCount(0)
  await expect(panel).toBeVisible()
  const areas = panel.getByRole('button', { name: 'Station areas' })
  await expect(areas).toHaveAttribute('aria-pressed', 'false')
  await areas.click()
  await expect(areas).toHaveAttribute('aria-pressed', 'true')

  // WebGL is required for 3D; the SVG fallback has no 3D control.
  test.skip(await map.getAttribute('data-engine') !== 'webgl', 'WebGL unavailable in this browser')
  const threeD = page.getByRole('button', { name: '3D view' })
  await threeD.click()
  await expect(threeD).toHaveAttribute('aria-pressed', 'true')
  await expect(map).toContainText('3D view')
  await threeD.click()
  await expect(threeD).toHaveAttribute('aria-pressed', 'false')

  await page.locator('[data-map-station="fs-21"]').dispatchEvent('click')
  await expect(map.getByRole('listitem').filter({ hasText: 'mi straight-line' })).toBeVisible()
})

test('activity scrubber filters the map and queue to a time window', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/')
  await expect(page.locator('[data-map-incident]')).toHaveCount(5, { timeout: 15_000 })
  const track = page.locator('[data-ui="time-track"]')
  await track.scrollIntoViewIfNeeded()
  await track.focus()
  // Keyboard: arrows create and move a window; Escape clears it.
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('[data-ui="time-window"]')).toBeVisible()
  const box = (await track.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.2, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.995, box.y + 20, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('[data-ui="time-window"]')).toContainText('events')
  // The window covers the past day, so closed incidents join the active ones on the map.
  await expect.poll(() => page.locator('[data-map-incident]').count()).toBeGreaterThan(5)
  await page.getByRole('button', { name: 'Clear time window' }).click()
  await expect(page.locator('[data-ui="time-window"]')).toHaveCount(0)
  await expect(page.locator('[data-map-incident]')).toHaveCount(5)
})

test('relationship graph selects an incident and shows its linked objects', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 })
  await page.goto('/readiness?view=incidents&pane=graph')
  const graph = page.locator('[data-ui="link-graph"]').first()
  await expect(graph.locator('[data-graph-node^="incident:"]')).toHaveCount(5, { timeout: 15_000 })
  await expect.poll(() => graph.locator('[data-graph-node^="apparatus:"]').count()).toBeGreaterThan(0)
  await graph.locator('[data-graph-node="incident:inc-02"]').click()
  await expect(page).toHaveURL(/incident=inc-02/)
  await expect(page.locator('[data-ui="graph-card"]')).toContainText('linked')
  await expect(page.getByRole('complementary', { name: 'Incident record' }).getByLabel('Linked objects graph')).toBeVisible()
  // Keyboard reaches nodes too.
  await graph.locator('[data-graph-node="incident:inc-03"]').focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/incident=inc-03/)
})
