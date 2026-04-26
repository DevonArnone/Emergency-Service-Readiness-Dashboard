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
```

Run these checks for backend changes:

```bash
cd backend
python -m pytest test_phase1.py test_phase2.py test_phase4.py
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
| Visual regression | Store updated screenshots in `docs/screenshots/` after major UI changes |
| External-service coupling | Preserve placeholder-backed local mode for Kafka and Snowflake |
| Long-running plan loss | Use checked-in execution plans for multi-step work |

## Promotion Rule

When a quality issue appears twice, convert it into one of the following:

- A test.
- A harness check.
- A documented architectural constraint.
- A reusable helper with typed inputs and outputs.
