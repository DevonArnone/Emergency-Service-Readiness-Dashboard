# Quality Gates

This document tracks the checks and quality expectations that keep the emergency readiness platform maintainable.

## Required Checks

Run these checks for documentation, architecture, or process-only changes:

```bash
make check-harness
```

Run these checks for dashboard changes:

```bash
cd dashboard
npm run lint
npm run build
npm run test:e2e
```

Run these checks for backend changes:

```bash
cd backend
python -m unittest discover -s tests -v
```

Run these checks for Snowflake pipeline changes:

```bash
python3 scripts/check_harness.py
```

Then inspect the edited SQL for idempotency, schema separation, and task cadence.

## Quality Bar

| Area | Current expectation |
| --- | --- |
| Frontend | Pages render with typed props/state, clear loading states, and no layout-breaking text overflow |
| Browser | Chromium and Firefox load every workspace with live data in under 10 seconds |
| Backend | Routes validate inputs and return explicit response shapes |
| Realtime | WebSocket messages have stable event names and payload structures |
| Data pipeline | RAW ingestion, stream processing, and analytics views stay separated |
| Operations | Local setup works without external Kafka or Snowflake credentials |
| Documentation | Behavior changes update the nearest source of truth |

## Risk Register

| Risk | Mitigation |
| --- | --- |
| Documentation drift | `scripts/check_harness.py` verifies required docs, links, and plan sections |
| Boundary shape drift | Keep API and WebSocket payloads modeled in `backend/app/models.py` |
| Visual regression | Validate desktop and mobile routes in a real browser and refresh `pictures/` after major UI changes |
| External-service coupling | Keep fallback mode explicit; verify real services independently and never label mock results as integration evidence |
| Long-running plan loss | Use checked-in execution plans for multi-step work |

## September 14 security and interface checkpoint

- Sixteen Chromium/Firefox workspace checks passed after removing repeated tenant-wide and per-station database lookups.
- Real Keycloak PKCE sign-in, operator incident creation/resolution, analyst write denial, authenticated Redis-backed WebSocket connection, and logout passed against PostgreSQL.
- Frontend `npm audit` and backend `pip-audit` reported no known vulnerabilities after dependency updates; backend dependency compatibility passed.
- See [security model and deployment gates](./security.md). Kafka end-to-end throughput, Snowflake live connectivity, and requested resume performance numbers remain unverified.

## Promotion Rule

When a quality issue appears twice, convert it into one of the following:

- A test.
- A harness check.
- A documented architectural constraint.
- A reusable helper with typed inputs and outputs.
