# Aegis Command Snowflake deployment

This deployment models Snowflake as the analytical plane, not the operational system of record. PostgreSQL remains authoritative; versioned Kafka events feed tenant-scoped warehouse tables and command-level aggregates.

Row access policies require Snowflake Enterprise Edition or higher. The scripts are a first-install path; existing deployments must apply reviewed migrations rather than replay policy attachments. Source references: [row access policies](https://docs.snowflake.com/en/user-guide/security-row-intro), [streams](https://docs.snowflake.com/en/sql-reference/sql/create-stream), [tasks](https://docs.snowflake.com/en/sql-reference/sql/create-task), and [connector key authentication](https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-connect).

Snowflake standard-table primary keys are informational. Raw landing events may repeat after replay; incident aggregation deduplicates tenant/event keys before recomputing changed hours. Keep validation output with any integration evidence. Tasks run every minute, so warehouse freshness is separate from the real-time alert delivery target.

Run the scripts once, in numeric order, with a role that can create roles, warehouses, databases, policies, and tasks:

1. `00_security.sql` — least-privilege roles, warehouse, database, and schemas.
2. `01_schema.sql` — tenant-scoped raw, security, and analytics objects plus row-access policies.
3. `02_kafka_ingestion.sql` — Snowflake Kafka Connector landing table, quarantine path, stream, and normalization task.
4. `03_streams_and_tasks.sql` — independent analytical streams and incremental aggregate tasks.
5. `04_secure_views.sql` — current command, incident-tempo, and tenant-health views.
6. `05_validation.sql` — deployment, isolation, quality, and task-history checks.

Map reader roles to organizations after deployment:

```sql
USE ROLE AEGIS_PLATFORM_ADMIN;
INSERT INTO AEGIS_ANALYTICS.SECURITY.ROLE_ORGANIZATION_ACCESS
    (ROLE_NAME, ORGANIZATION_ID)
VALUES
    ('FCFRD_CONCEPT_READER', 'fcfrd-demo');
```

The connector should write JSON envelopes into `RAW.KAFKA_EVENTS_LANDING` using the standard `RECORD_METADATA` and `RECORD_CONTENT` columns. The normalizer rejects records without an organization, event type, aggregate identity, or usable timestamp into `RAW.EVENT_QUARANTINE`.

All operational records in the public portfolio dataset are synthetic. Running these scripts proves deployable warehouse design; it does not prove a live Snowflake connection or a specific throughput result. Record those claims only from a captured integration run.
