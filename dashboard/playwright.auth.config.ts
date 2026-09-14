import { defineConfig, devices } from '@playwright/test'

// Explicit local integration profile. Requires compose postgres, redis and keycloak plus app.bootstrap.
export default defineConfig({
  testDir: './tests/auth',
  workers: 1,
  timeout: 45_000,
  use: { baseURL: 'http://localhost:3000', trace: 'off', screenshot: 'only-on-failure' },
  webServer: [
    {
      command: 'cd ../backend && DATABASE_URL=postgresql+psycopg://aegis_runtime:aegis-runtime-local-only@localhost:5432/aegis AUTO_CREATE_SCHEMA=false SEED_DEMO_ON_EMPTY=false AUTH_REQUIRED=true PUBLIC_DEMO_WRITE_ENABLED=true OIDC_ISSUER=http://localhost:8080/realms/aegis OIDC_DISCOVERY_URL= OIDC_JWKS_URL= REDIS_FANOUT_ENABLED=true CORS_ORIGINS=http://localhost:3000 ./venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000',
      url: 'http://localhost:8000/health', timeout: 30_000,
    },
    {
      command: 'NEXT_PUBLIC_OIDC_AUTHORITY=http://localhost:8080/realms/aegis npm run build && NEXT_PUBLIC_OIDC_AUTHORITY=http://localhost:8080/realms/aegis npx next start --hostname 127.0.0.1 --port 3000',
      url: 'http://localhost:3000', timeout: 90_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
