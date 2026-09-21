# Aegis Command

A map-led emergency coordination concept built with FastAPI, Next.js, normalized PostgreSQL, OIDC identity, Kafka priority channels, Redis fan-out, and a tenant-scoped Snowflake analytics deployment.

The interface is organized as a municipal systems room: indexed workspaces, a county status wall, instrument-style measures, dispatch and renewal dockets, and ruled operating worksheets. It is designed for fast exception scanning by duty officers without presenting itself as a CAD, dispatch, or patient-care system. See [product context](PRODUCT.md) and [design system](DESIGN.md).

**Target:** Fairfax County Fire and Rescue Department. **Unofficial portfolio concept—not affiliated with or endorsed by Fairfax County.** Public station geography is paired with 131 synthetic units, 1,450 synthetic personnel, eight synthetic battalion assignments, and a 363-position staffing model. No real incidents, personnel records, patient data, or county-system connections are included. See [target research and provenance](docs/target-research.md).

## Product tour

### Command Center

![Aegis command center with Fairfax station geography and synthetic readiness](pictures/aegis-command-desktop.png)

The county status wall fits its complete operating picture at 1536×1024: 39 keyboard-accessible station markers on locally committed [Fairfax County iCare GIS](https://www.fairfaxcounty.gov/gisint2/rest/services/DTA/iCare/MapServer) geometry, live dispatch and notice registers, resource posture, and a downloadable duty-officer brief. Station, incident, and risk layers remain interactive. [View the mobile command center](pictures/aegis-command-mobile.png).

### Operations

![Aegis operations workspace with readiness, alerts, incidents, and contingency tools](pictures/aegis-readiness-desktop.png)

Unit readiness, exception resolution, incident command, qualified assignments, and non-destructive staffing scenarios share one operational workspace. [View Operations on mobile](pictures/aegis-readiness-mobile.png).

### Workforce

![Aegis workforce workspace with searchable roster and operational profile](pictures/aegis-personnel-desktop.png)

The department-scale roster supports station scope, status filters, pagination, verified credential dates, availability control, guarded archival, and active assignments. [View Workforce on mobile](pictures/aegis-personnel-mobile.png).

### Scheduling

![Aegis scheduling workspace with coverage metrics and live roster](pictures/aegis-shifts-desktop.png)

Operators can create shifts, validate coverage windows, assign qualified personnel, clock roster members in and out, and safely cancel shifts. [View Scheduling on mobile](pictures/aegis-shifts-mobile.png).

### Credentials

![Aegis credentials workspace with renewal queue and qualification risk](pictures/aegis-certifications-management-desktop.png)

Credential work includes renewal ownership, scheduling, completion tracking, workforce risk, protected definitions, and unit qualification requirements. [View Credentials on mobile](pictures/aegis-certifications-management-mobile.png).

### Analytics

![Aegis analytics workspace with readiness and staffing visualizations](pictures/aegis-analytics-desktop.png)

The analytics workspace exposes readiness, staffing, qualification risk, and coverage trends with shareable URL state and station scope. [View Analytics on mobile](pictures/aegis-analytics-mobile.png).

### Weather

![Aegis Fairfax weather register with forecast, wind, hazards, and source freshness](pictures/aegis-weather-desktop.png)

The weather register presents the [National Weather Service API](https://www.weather.gov/documentation/services-web-api) forecast and active alerts for planning, with source time, cached/stale state, and a clear unavailable state. It does not replace official warning or dispatch channels. [View Weather on mobile](pictures/aegis-weather-mobile.png).

### Admin

![Aegis access and service register showing identity, rights, and system provenance](pictures/aegis-admin-desktop.png)

The access register makes the current identity, effective permissions, service checks, and data provenance visible. The existing synthetic demo reset remains permission-gated and requires confirmation. [View Admin on mobile](pictures/aegis-admin-mobile.png).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · TanStack Query · Zod · Radix UI · Recharts |
| API | FastAPI · Pydantic v2 · Python 3.11+ |
| Streaming | Kafka protocol (local Redpanda) · transactional outbox · Redis · tenant-scoped WebSockets |
| Warehouse | Snowflake · Streams & Tasks · SQL aggregation pipeline |
| Data store | Normalized PostgreSQL with migrations and row security · relational SQLite fallback |
| Identity | OIDC authorization code + PKCE · Keycloak local fixture · role-based API policy |
| Public context | Locally committed Fairfax County iCare GIS geometry · cached National Weather Service forecast and alerts |

---

## Architecture

```
Browser → authenticated FastAPI → PostgreSQL records + outbox
                                      ↓
                    separate priority / bulk Kafka topics
                                      ↓
                           Redis → tenant WebSockets

Kafka → configured Snowflake connector → RAW → Streams & Tasks → ANALYTICS
```

Three WebSocket channels:
- `/ws/shifts` — shift-level clock-in/out and alert events
- `/ws/unit-readiness/{unit_id}` — per-unit readiness push
- `/ws/operations` — event push plus a 15-second recovery snapshot

See [architecture](docs/architecture.md) and [security boundaries](docs/security.md). Live Snowflake deployment is not yet verified. [Measured local pipeline results](backend/benchmarks/README.md) include 1,000/1,000 delivered events at 100 offered events/second with 28.953 ms p95 alert latency. At 500 offered events/second the stack saturated around 183 accepted events/second and missed the 200 ms target. A 60% consumer-lag reduction is **not substantiated**.

## Engineering Harness

Repository operating rules live in [PROJECT_GUIDE.md](./PROJECT_GUIDE.md). The guide links to the maintained architecture, quality gates, execution-plan template, and harness checks.

Run the harness check before merging documentation, architecture, process, or validation changes:

```bash
make check-harness
```

---

## Features

### Operations Board (`/readiness`)
- Master-detail unit workspace with search and readiness-state filters
- Readiness scoring: staffing ratio − cert penalties − expired cert penalties
- Alert queue: OPEN → ACKNOWLEDGED → RESOLVED lifecycle with actor metadata
- Incident command workflow with maintained type, display location, lifecycle status, creation, and resolution
- Non-destructive callout and unit-offline contingency simulation
- Conflict- and credential-aware personnel assignment

### Workforce (`/personnel`)
- Searchable roster views for deployable, assigned, and unavailable personnel
- Detailed operational profile with station, unit, credential, and assignment context
- Personnel creation, editing, availability changes, and guarded archival

### Shifts (`/shifts`)
- Date-based shift schedule with station scope and coverage summaries
- Shift creation and cancellation with linked assignment handling
- Roster assignment plus clock-in and clock-out actions
- Durable activity history and live staffing-gap status

### Analytics (`/analytics`)
- Focused Overview, Readiness, Staffing, Credentials, and Coverage tabs
- URL-backed 7/14/30/90-day windows and optional period baseline
- Station-scoped queries that filter at the API boundary
- Readiness trajectories, staffing gaps, credential risk, and live shift coverage
- CSV export for the active analysis view

### Credentials (`/certifications-management`)
- Prioritized renewal queue with owners, scheduling, and completion
- Workforce qualification forecast with task creation
- Dependency-aware certification editing and guarded deletion
- Per-unit qualification requirement matrix

### Weather and Administration (`/weather`, `/admin`)
- NWS forecast, wind, active alerts, source freshness, and offline/stale fallback
- Current identity, effective access rights, service health, and synthetic-data provenance
- Permission-gated, confirmed local demo reset; no new administrative privileges

### Alert Lifecycle
```
OPEN → ACKNOWLEDGED (actor + note) → RESOLVED
```
Alert types: `UNDERSTAFFED_UNIT`, `EXPIRED_CERTIFICATION`, `EXPIRING_CERTIFICATION`, `OVERTIME_RISK`, `UNIT_OFFLINE`

### Recommendation Engine
The rules-based recommendation endpoint evaluates current readiness:
- **REASSIGN** — available qualified personnel found for understaffed unit
- **ESCALATE** — no qualified replacements; triggers mutual-aid recommendation
- **RENEW_CERT** — expired or expiring credential requires renewal scheduling

### What-If Simulation
`POST /api/simulations/staffing-gap` — specify personnel to remove or a unit offline scenario; returns original vs. degraded readiness per unit and recommended recovery actions.

---

## API Reference (67 method/path operations)

The current OpenAPI document exposes 67 method/path operations, exceeding the 30+ endpoint requirement. The count includes compatibility and administrative operations, not 67 independent product features.

```
GET  /api/dashboard/summary          — overall readiness, alerts, incidents, station summaries
GET  /api/alerts                     — all alerts (filter by ?state=OPEN|ACKNOWLEDGED|RESOLVED)
POST /api/alerts/{id}/acknowledge    — acknowledge with actor and note
POST /api/alerts/{id}/resolve        — resolve alert
GET  /api/stations                   — station list
GET  /api/incidents                  — active operational incidents
GET  /api/operations/snapshot        — live readiness and typed command-board aggregates
GET  /api/weather/fairfax            — cached NWS forecast, wind, alerts, and freshness
GET  /api/recommendations            — rules-based recommendations (optional ?unit_id=)
GET  /api/analytics/readiness-trends — readiness by ?days= and optional ?station_id=
GET  /api/analytics/certification-risk — risk by ?days_ahead= and optional ?station_id=
GET  /api/analytics/staffing-gaps    — staffing gap by optional ?station_id=
POST /api/simulations/staffing-gap   — what-if simulation
POST /api/demo/reset                 — authenticated, opt-in local synthetic reset only
GET  /api/readiness/units            — live unit readiness scores
GET  /api/personnel                  — personnel list
GET  /api/certifications/expiring    — certs expiring within N days
```

Full Swagger docs at `http://localhost:8000/docs`.

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- (Optional) Confluent Kafka credentials
- (Optional) Snowflake account

### Complete local stack

```bash
docker compose up --build -d
```

This starts PostgreSQL, the migration/seed job, Redis, Redpanda, Keycloak, the API, workers, and dashboard. The default concept is read-only. For sign-in and writable synthetic workflows, follow the explicit [local operator profile](docs/security.md#local-operator-profile). Local credentials must never be deployed. Volumes preserve data across restarts.

### Lightweight backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Without a database override, this profile uses normalized SQLite and seeds an empty local database. It is useful for UI development, but is not PostgreSQL or Kafka integration evidence. Anonymous reset and other mutations are denied.

### Frontend

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Validation

```bash
make check-harness
cd backend && python -m unittest discover -s tests -v
cd dashboard && npm run lint && npx tsc --noEmit && npm run build
cd dashboard && npm run test:e2e
```

### Environment Variables

**Backend** (`.env` in `backend/`):
```
KAFKA_BOOTSTRAP_SERVERS=placeholder   # leave as placeholder for local dev
SNOWFLAKE_ACCOUNT=placeholder         # leave as placeholder for local dev
```
When set to `placeholder`, Kafka and Snowflake fall back to mock implementations — the app runs fully without external services.

**Frontend** (`.env.local` in `dashboard/`):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## Snowflake Pipeline (optional)

The `data-pipeline/snowflake/` directory contains SQL scripts for:
1. Tenant-scoped RAW operational events and reference tables
2. Kafka connector ingestion and envelope normalization
3. Streams and Tasks for automated ETL
4. ANALYTICS views (SHIFT_COVERAGE_HOURLY, UNIT_READINESS_AGGREGATES)

See the current [Snowflake deployment guide](data-pipeline/snowflake/README.md). Legacy setup notes are not the source of truth. Live account deployment, row-policy checks, and representative workload testing remain required.

---

## Project Structure

```
├── backend/
│   └── app/
│       ├── api/           # REST routes (shifts, readiness, operations)
│       ├── services/      # Readiness, certification, recommendation, demo, Kafka, Snowflake
│       ├── websocket/     # WebSocket connection managers
│       ├── models.py      # Pydantic domain models
│       ├── db/            # Normalized relational models and tenant-scoped adapters
│       ├── workers/       # Outbox publishing and Kafka-to-Redis bridges
│       ├── stores.py      # Typed relational domain stores
│       └── main.py        # FastAPI app, startup seed, WebSocket endpoints
├── dashboard/
│   ├── app/                # Route workspaces and shared visual system
│   ├── components/         # Command shell and reusable UI primitives
│   ├── hooks/              # Live operations stream integration
│   └── lib/                # Typed API client, schemas, and utilities
└── data-pipeline/
    └── snowflake/                         # SQL pipeline scripts
```

---

## License

MIT © Devon Arnone
