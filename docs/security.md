# Security model and deployment gates

Aegis is an unofficial, synthetic Fairfax County Fire and Rescue concept. It is not authorized for dispatch, patient care, personnel decisions, or real emergency operations. No compliance certification is claimed.

## Enforced boundaries

- OIDC authorization code with S256 PKCE; no client secret in the browser. Access tokens stay in memory, and the short-lived authorization transaction uses session storage. Reloading requires a new SSO round trip. Expiry clears the mounted workspace and cached data.
- The API verifies asymmetric signatures, expiration, issuer, audience, subject, and an explicit organization claim. Production protected reads cannot fall back to anonymous access.
- Viewer and analyst roles can read. Duty officer, battalion chief, and admin roles can change their own tenant's records. Integration services can ingest only into their assigned tenant. Tenant admin is not cross-tenant admin.
- Anonymous concept access is read-only. The default synthetic organization is treated as public even if the token omits the demo flag. Local writes require both operator identity and explicit `PUBLIC_DEMO_WRITE_ENABLED=true`; production rejects that flag.
- Demo reset requires an authenticated operator, the default demo tenant, the development environment, and the local-write flag. The UI hides it otherwise and asks for confirmation.
- Relational lookups, update ownership checks, referenced records, legacy WebSocket subscriptions, aggregated live snapshots, and event channels retain organization scope.
- PostgreSQL migrations enable and force tenant row policies. Compose separates the migration account from a `NOSUPERUSER NOBYPASSRLS` runtime account. SQLite is a local development fallback, not a substitute for PostgreSQL row security.
- WebSocket upgrades use short-lived, single-use tickets. Distributed mode uses atomic Redis `GETDEL`; development memory storage expires and caps pending grants. Invalid tickets and untrusted browser origins are rejected. Server logs redact ticket values.
- API errors omit internal exception details. Security headers, explicit CORS origins, and trusted hosts are configured. Development service ports bind only to loopback.

## Local operator profile

The default stack is a read-only public concept. For an explicitly writable **local synthetic** profile:

```bash
AUTH_REQUIRED=true PUBLIC_DEMO_WRITE_ENABLED=true NEXT_PUBLIC_OIDC_AUTHORITY=http://localhost:8080/realms/aegis docker compose up --build -d
```

Use `duty.officer` or `analyst`, password `aegis-local-only`, at `http://localhost:3000`. All checked-in passwords are for the loopback-only local stack. Never deploy them. Keycloak uses a public client with an exact callback URI. The fixed `fcfrd-demo` mapper is a local fixture; deployment requires controlled membership provisioning and per-user organization claims.

On a pre-existing development PostgreSQL volume, provision the runtime role once before upgrading:

```bash
docker compose exec -T postgres psql -U aegis -d aegis < infra/postgres/runtime-role.sql
```

The migration service initializes an empty database; it does not reset existing records. Database volumes persist across restarts. Do not remove volumes to upgrade.

## Verification

```bash
cd backend
venv/bin/python -m unittest discover -s tests -v
INTEGRATION_DATABASE_URL=postgresql+psycopg://aegis_runtime:aegis-runtime-local-only@localhost:5432/aegis venv/bin/python -m unittest discover -s tests/integration -v
venv/bin/python -m pip_audit
venv/bin/python -m pip check
cd ../dashboard
npm audit
npm run test:e2e
npm run test:e2e -- --config=playwright.auth.config.ts
```

The separate auth suite requires PostgreSQL, Redis and Keycloak, and `python -m app.bootstrap` against the migration database URL. It creates and resolves one explicitly labeled synthetic QA incident. It does not record authentication traces or persist access tokens to artifacts.

## Before any real deployment

Required work still includes managed TLS and secrets, IdP MFA and account recovery, tenant provisioning/offboarding, gateway request-size and rate limits, Kafka/Redis ACLs and encryption, migration-only schema privileges, database backup/restore exercises, immutable external audit retention, disaster-recovery drills, load/failure testing, and an independent security review. Audit hashes are not proof against a privileged database administrator or concurrent chain forks. PostgreSQL reference constraints need a further composite-tenant integrity pass. Do not equate a clean dependency scan or passing tests with production certification.

References: [OIDC browser client](https://authts.github.io/oidc-client-ts/), [PKCE specification](https://www.rfc-editor.org/info/rfc7636/), [PostgreSQL row security](https://www.postgresql.org/docs/16/ddl-rowsecurity.html).
