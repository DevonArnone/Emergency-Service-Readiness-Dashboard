import { defineConfig, devices } from '@playwright/test'

const isolatedDatabase = process.env.E2E_AUTH_DATABASE_URL
const database = isolatedDatabase || 'postgresql+psycopg://aegis_runtime:aegis-runtime-local-only@localhost:5432/aegis'

// Explicit local integration profile. Uses its own API port so a read-only compose API
// can remain running while the authenticated workflow exercises write permissions.
export default defineConfig({
  testDir: './tests/auth',
  workers: 1,
  timeout: 45_000,
  use: { baseURL: 'http://localhost:3000', trace: 'off', screenshot: 'only-on-failure' },
  webServer: [
    {
      command: `cd ../backend && SNOWFLAKE_ACCOUNT=placeholder SNOWFLAKE_USER=placeholder SNOWFLAKE_PASSWORD=placeholder KAFKA_BOOTSTRAP_SERVERS=localhost:19092 DATABASE_URL=${database} AUTO_CREATE_SCHEMA=${isolatedDatabase ? 'true' : 'false'} SEED_DEMO_ON_EMPTY=${isolatedDatabase ? 'true' : 'false'} AUTH_REQUIRED=true PUBLIC_DEMO_WRITE_ENABLED=true OIDC_ISSUER=http://localhost:8080/realms/aegis OIDC_DISCOVERY_URL= OIDC_JWKS_URL= REDIS_FANOUT_ENABLED=true CORS_ORIGINS=http://localhost:3000 ./venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8011`,
      url: 'http://localhost:8011/health', timeout: 30_000,
    },
    {
      command: 'NEXT_PUBLIC_API_BASE_URL=http://localhost:8011 NEXT_PUBLIC_OIDC_AUTHORITY=http://localhost:8080/realms/aegis npm run build && NEXT_PUBLIC_API_BASE_URL=http://localhost:8011 NEXT_PUBLIC_OIDC_AUTHORITY=http://localhost:8080/realms/aegis npx next start --hostname 127.0.0.1 --port 3000',
      url: 'http://localhost:3000', timeout: 90_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
