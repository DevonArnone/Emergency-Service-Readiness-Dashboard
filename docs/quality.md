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

## September 15 security and interface checkpoint

- Twenty-two Chromium/Firefox workspace checks passed after removing repeated tenant-wide and per-station database lookups and adding responsive pagination, failure recovery, safe read-only controls, deep links, and handover export.
- Three real browser journeys passed against PostgreSQL, Redis, and Keycloak: duty-officer PKCE, analyst read-only enforcement, and a complete operator workflow spanning personnel, incidents, shifts, attendance, credentials, guarded deletion, and archival.
- Frontend `npm audit` and backend `pip-audit` reported no known vulnerabilities after dependency updates; backend dependency compatibility passed.
- See [security model and deployment gates](./security.md). Snowflake live connectivity and requested resume performance numbers remain unverified.

## September 15 pipeline checkpoint

- Forty-five backend checks passed, including atomic operational/outbox writes, broker-acknowledgment gating, tenant-scoped event identities, Redis failure retry, invalid-message quarantine, overnight shifts, assignment conflict handling, cancellation, attendance, and local-date shift selection.
- Twenty-two Chromium/Firefox workspace checks and three authenticated integration journeys passed in the final audit. Direct PostgreSQL runtime-role row security passed independently.
- Real authenticated PostgreSQL → Kafka → Redis → WebSocket runs delivered every requested event. At 100 offered events/second, priority alert p95 was 28.953 ms; at 500 offered events/second, accepted throughput saturated near 183/s and p95 was 1,094.147 ms. See [complete results and resource profile](../backend/benchmarks/README.md).
- The user accepted stopping latency optimization at this point. This is not permission to claim 60% consumer-lag reduction or production-scale guarantees; the final product work does not alter those measured limits.

## Promotion Rule

When a quality issue appears twice, convert it into one of the following:

- A test.
- A harness check.
- A documented architectural constraint.
- A reusable helper with typed inputs and outputs.
