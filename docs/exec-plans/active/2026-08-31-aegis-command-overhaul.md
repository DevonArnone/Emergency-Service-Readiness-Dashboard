# Aegis Command Overhaul

## Goal

Turn the existing emergency-readiness demo into Aegis Command: a secure, department-scale, evidence-backed coordination companion tailored to an unofficial Fairfax County Fire and Rescue concept environment. The finished repository must use durable relational storage, a real priority-isolated event pipeline, Snowflake-ready multi-tenant analytics, a cinematic operational interface, and reproducible proof for every resume claim.

## Scope

- Replace the SQLite JSON entity store with normalized PostgreSQL persistence and migrations.
- Add organization scoping, role-aware access control, secure realtime tickets, auditability, and production-safe configuration.
- Split high-priority and bulk Kafka traffic, add Redis fan-out, and create a repeatable latency/lag benchmark.
- Seed public Fairfax station and battalion context with synthetic department-scale personnel, units, and incidents.
- Rework Snowflake schemas and analytics around tenant-aware event ingestion.
- Redesign the Next.js experience as Aegis Command with a map-led command surface and polished operational workspaces.
- Add observability, security checks, runbooks, evidence, screenshots, and updated product documentation.

## Out of Scope

- Replacing CAD, dispatch, ePCR, payroll, or clinical record systems.
- Connecting to private Fairfax County systems or presenting the project as officially affiliated.
- Storing patient identifiers, clinical narratives, ePHI, or real personnel and incident records.
- Claiming latency, lag reduction, Snowflake connectivity, or compliance without reproducible evidence.

## Acceptance Criteria

- PostgreSQL is the authoritative operational database; application state no longer depends on an in-process mapping or JSON entity table.
- Every tenant-owned record and query is organization-scoped, with tested denial of cross-tenant access.
- Authentication and authorization protect mutations; the public synthetic tenant remains read-only.
- High-priority alerts use a separate partitioned Kafka topic and consumer path from bulk operational events.
- A benchmark compares the old shared path with the optimized path and records p95 alert latency and consumer lag reduction.
- Snowflake raw and analytics objects include organization scope and least-privilege setup.
- The default dataset represents 39 stations, eight battalions, 131 frontline units, and approximately 1,450 synthetic personnel.
- The Aegis Command first viewport exposes a useful live command surface rather than a marketing hero.
- Frontend, backend, migration, security, integration, and browser checks pass from documented commands.
- Git history for the overhaul uses only Devon Arnone as author and committer, with commit subjects shorter than ten words.

## Implementation Steps

- [ ] Record the baseline, target architecture, and migration decisions.
- [ ] Add PostgreSQL models, migrations, tenant context, and compatibility import tooling.
- [x] Add authentication, authorization, security middleware, audit controls, and realtime tickets.
- [ ] Add the local PostgreSQL, Kafka, Redis, identity, worker, and observability stack.
- [ ] Implement outbox publishing, priority/bulk topics, consumers, Redis fan-out, and event schemas.
- [ ] Add the reproducible baseline-versus-optimized benchmark and evidence output.
- [ ] Add Fairfax-scale seed data and public GIS snapshots with attribution.
- [ ] Rework Snowflake ingestion, roles, row policies, and analytical views.
- [x] Build the Aegis Command visual system and first meaningful command preview.
- [ ] Migrate and polish all supporting operational workspaces.
- [ ] Add observability, accessibility, security scanning, threat model, and runbooks.
- [ ] Run the full completion audit, update evidence, refresh screenshots, and finalize documentation.

## Validation

- `make check-harness`
- `backend/venv/bin/python -m unittest discover -s backend/tests -v`
- PostgreSQL-backed migration and integration test suite
- Kafka/Redis pipeline contract and failure-path tests
- Benchmark run with fixed workload and resource profile
- `npm run lint`, `npm run build`, and `npm run test:e2e` in `dashboard/`
- Browser review of the command, readiness, incidents, workforce, analytics, and administration surfaces
- Git author, committer, and subject-length audit for every overhaul commit

## Decision Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-08-31 | Use Aegis Command with an explicit unofficial FCFRD concept label. | Provides a distinctive product identity without implying county endorsement. |
| 2026-08-31 | Position the system beside CAD and ePCR rather than replacing them. | Keeps the project credible, bounded, and safe for a pilot-shaped portfolio build. |
| 2026-08-31 | Use PostgreSQL for operations and Snowflake for analytics. | Separates transactional correctness from warehouse-scale aggregation. |
| 2026-08-31 | Use Redpanda locally through the Kafka protocol. | Makes priority-topic behavior reproducible without weakening the production Kafka contract. |
| 2026-08-31 | Exclude PHI and all real operational records. | Reduces privacy risk and keeps the public demo appropriate for portfolio review. |
| 2026-08-31 | Treat requested resume numbers as gated targets. | Prevents unsupported performance claims from appearing in project documentation. |

## Completion Notes

In progress. September 14: the map-led command screen and responsive Aegis visual system are implemented. All sixteen Chromium/Firefox workspace checks pass; populated desktop and mobile captures are in `pictures/`. Repeated database lookups have been removed. Thirty-five backend tests, direct PostgreSQL RLS checks, and two real Keycloak/Redis/PostgreSQL operator-access browser tests pass. Both dependency audits report no known vulnerabilities. See `docs/security.md` for remaining deployment gates. Kafka reliability/performance and live Snowflake evidence remain outstanding.
