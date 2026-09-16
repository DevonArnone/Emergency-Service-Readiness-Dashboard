# Architecture Documentation

## System Overview

Aegis Command is an unofficial Fairfax County Fire and Rescue coordination concept using public station geography and synthetic operational records. PostgreSQL owns operational state. Snowflake is a separate analytical plane, not the transactional database.

## Components

| Component | Responsibility |
| --- | --- |
| Next.js dashboard | Map-led command surface, six operational workspaces, scoped queries, typed response validation |
| OIDC provider | Authorization-code/PKCE login, roles and explicit organization claims |
| FastAPI | 64 API method/path operations, authorization, validation, tenant context and live snapshots; four Compose processes by default (`API_WORKERS` configurable) |
| PostgreSQL | Normalized operational records, audit events and transactional outbox |
| Alert outbox worker | Independently publishes priority events and waits for broker acknowledgment |
| Bulk outbox worker | Publishes non-priority events; the baseline profile uses a single shared outbox path |
| Kafka / local Redpanda | Six priority partitions, twelve bulk partitions, audit and dead-letter topics |
| Realtime bridges | Publish validated Kafka events to tenant Redis channels, commit only after delivery or quarantine |
| Redis | Cross-process single-use upgrade tickets and cross-node live fan-out |
| Snowflake deployment | Tenant-scoped RAW ingestion, independent streams, hourly aggregates and secured views |

## Operational writes

Relational store changes and their outbox events commit in one database transaction. Rollback removes both. The event payload contains identifiers and operational state rather than names and free-text notes. Existing REST workflows retain local legacy socket notifications, but no longer synchronously dual-write clock events to the warehouse.

Outbox publishing is at-least-once. A successful producer enqueue is not a broker acknowledgment. Unconfirmed deliveries remain pending with retry backoff. A crash after delivery but before database commit can duplicate an event; consumers and warehouse aggregations must deduplicate using organization plus event ID. Integration ingestion accepts an idempotency key within the tenant.

## Realtime delivery and recovery

Priority and bulk traffic use independent outbox workers, topics and consumer groups. The shared baseline intentionally routes both through one topic and publisher path. The benchmark records these topology differences; it is not an equal-consumer-count comparison.

Bridges validate event contracts. Invalid events go to a dead-letter topic before their source offset advances. Transient delivery failures retry the same offset. Redis Pub/Sub is not a durable client replay log: disconnected dashboards recover from the authenticated relational snapshot, not guaranteed delivery of every historical push.

WebSocket tickets expire after 30 seconds by default and are consumed once. Every channel retains organization scope. The operations channel pushes pipeline events and sends a recovery snapshot approximately every 15 seconds. Frontend queries invalidate on both event types.

## Persistence and tenancy

The schema includes organizations, memberships, battalions, stations, units, personnel, certification types and associations, assignments, shifts, incidents, alerts, renewals, audit events and outbox records. Indexed relational point lookups replace whole-tenant reads for individual records.

Compose runs migration/seed work under a dedicated migration identity and serves API traffic under a non-superuser, non-bypass-RLS role. Tenant policies are enabled and forced. Application adapters additionally validate record ownership and foreign references. Direct PostgreSQL tests verify no rows without tenant context, the expected demo rows in scope, and no rows under another tenant.

SQLite uses the normalized schema for lightweight development only. The legacy JSON-store module remains solely for compatibility/import tooling and its regression test.

## Analytics and evidence limits

Snowflake SQL and Python queries include organization scope. Deployment requires an external account, appropriate edition/features, roles, connector configuration and live verification. Static SQL checks do not prove that an account has been provisioned or that warehouse throughput scales.

Local historical charts use synthetic trajectories and must not be presented as measured historical operations. The benchmark saves HTTP-to-WebSocket latency and broker offset observations; neither mock data nor a small smoke run establishes the requested resume claims. See the [reproducible measurements and limitations](../backend/benchmarks/README.md).

## Security and operations

See [security model and deployment gates](security.md), [quality checks](quality.md), [target research](target-research.md), and the [completed execution plan](exec-plans/completed/2026-08-31-aegis-command-overhaul.md). TLS, production secret management, gateway limits, deployment-specific ACLs, immutable audit retention, recovery drills and an independent review remain prerequisites for real operational use.
