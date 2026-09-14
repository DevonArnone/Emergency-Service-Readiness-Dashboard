import { test, expect } from '@playwright/test'

for (const username of ['duty.officer', 'analyst']) {
  test(`${username} signs in through PKCE with the correct permissions`, async ({ page, request }) => {
    let authorization = ''
    page.on('request', (outgoing) => {
      if (outgoing.url() === 'http://localhost:8000/api/v1/session') authorization = outgoing.headers().authorization || ''
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign in to command' }).click()
    await expect(page).toHaveURL(/code_challenge_method=S256/)
    await page.getByLabel(/Username|Email/).fill(username)
    await page.getByLabel('Password', { exact: true }).fill('aegis-local-only')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Every resource. One clear picture.' })).toBeVisible({ timeout: 20_000 })
    await expect.poll(() => Boolean(authorization)).toBe(true)
    const profile = await request.get('http://localhost:8000/api/v1/session', { headers: { authorization } })
    expect(profile.status()).toBe(200)
    expect((await profile.json()).can_write).toBe(username === 'duty.officer')
    await expect(page.getByText('Operations connected', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('oidc.')))).toBe(false)
    const anonymous = await request.get('http://localhost:8000/api/stations')
    expect(anonymous.status()).toBe(401)
    const mutation = await request.post('http://localhost:8000/api/incidents', {
      headers: { authorization }, data: { title: 'QA synthetic access check', priority: 'LOW' },
    })
    if (username === 'analyst') {
      expect(mutation.status()).toBe(403)
    } else {
      expect(mutation.status()).toBe(200)
      const incident = await mutation.json()
      const resolved = await request.post(`http://localhost:8000/api/incidents/${incident.incident_id}/resolve`, { headers: { authorization } })
      expect(resolved.status()).toBe(200)
    }
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Sign in to command' })).toBeVisible()
  })
}
