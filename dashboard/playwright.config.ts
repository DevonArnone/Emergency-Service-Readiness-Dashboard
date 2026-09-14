import { defineConfig, devices } from '@playwright/test'

const python = process.env.E2E_PYTHON || './venv/bin/python'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3010',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `cd ../backend && CORS_ORIGINS=http://127.0.0.1:3010 DATABASE_URL=sqlite+pysqlite:////tmp/aegis-ui-e2e.db STATE_DATABASE_PATH=/tmp/emergency-readiness-e2e.db SNOWFLAKE_ACCOUNT=placeholder SNOWFLAKE_USER=placeholder SNOWFLAKE_PASSWORD=placeholder ${python} -m uvicorn app.main:app --host 127.0.0.1 --port 8010`,
      url: 'http://127.0.0.1:8010/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8010 npm run build && NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8010 npx next start --hostname 127.0.0.1 --port 3010',
      url: 'http://127.0.0.1:3010',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
})
