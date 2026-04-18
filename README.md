# Emergency Readiness Platform

A full-stack emergency operations command center built to demonstrate production-grade architecture: real-time WebSocket push, event-driven Kafka pipeline, Snowflake warehouse analytics, and a FastAPI + Next.js 14 application layer — all grounded in realistic emergency-services domain logic.

**Live demo district:** Ridgecrest Emergency Services District (3 stations, 8 units, 25 personnel, seeded automatically on startup).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 · React 18 · TypeScript · Tailwind CSS · Recharts |
| API | FastAPI · Pydantic v2 · Python 3.11+ |
| Streaming | Apache Kafka (Confluent) · WebSockets (3 channels) |
| Warehouse | Snowflake · Streams & Tasks · SQL aggregation pipeline |
| Data store | In-memory (dev/demo) · Snowflake RAW schema (production) |

---

## Architecture

```
Browser ──WebSocket──▶ FastAPI ──Kafka producer──▶ Snowflake (via Snowpipe)
                          │                               │
                   REST API (40+)              Streams & Tasks → ANALYTICS views
                          │
                   In-memory stores (dev) / Snowflake RAW (prod)
```

Three WebSocket channels:
- `/ws/shifts` — shift-level clock-in/out and alert events
- `/ws/unit-readiness/{unit_id}` — per-unit readiness push
- `/ws/operations` — aggregated dashboard summary (10s heartbeat)

---

## Features

### Operations Board (`/readiness`)
- Unit grid sorted by readiness score (0–100) with filter by state and unit type
- Readiness scoring: staffing ratio − cert penalties − expired cert penalties
- Alert queue: OPEN → ACKNOWLEDGED → RESOLVED lifecycle with actor metadata
- Per-unit action drawer: crew list, issues, rules-based recommendations
- Real-time updates via per-unit WebSocket connections

### Workforce (`/personnel`)
- Personnel status table with deployable / constrained / training-only classification
- Credential expiration state per person (expired, expiring soon, OK)
- Unit grid with required certification display
- Inline personnel creation with cert + expiration date assignment

### Shifts (`/shifts`)
- 12-hour staffing timeline bar chart with gap markers
- Live shift status cards with clock-in/required ratio and progress bar
- Real-time event log via `/ws/shifts` WebSocket
- Unit assignment table for today's roster

### Analytics (`/analytics`)
- 14-day readiness trend by station (area chart)
- Station comparison line chart
- Staffing gap breakdown by unit (bar chart + table)
- Certification risk forecast: all personnel with certs expiring within 90 days
- Hourly scheduled vs. actual coverage from Snowflake (date-selectable)

### Credentials (`/certifications-management`)
- Certification library with category filters
- Expiring and expired credential tracker with configurable lookahead
- Create / edit / delete certification definitions

### Alert Lifecycle
```
OPEN → ACKNOWLEDGED (actor + note) → RESOLVED
```
Alert types: `UNDERSTAFFED_UNIT`, `EXPIRED_CERTIFICATION`, `EXPIRING_CERTIFICATION`, `OVERTIME_RISK`, `UNIT_OFFLINE`

### Recommendation Engine
Rules-based engine fires on every readiness check:
- **REASSIGN** — available qualified personnel found for understaffed unit
- **ESCALATE** — no qualified replacements; triggers mutual-aid recommendation
- **RENEW_CERT** — expired or expiring credential requires renewal scheduling

### What-If Simulation
`POST /api/simulations/staffing-gap` — specify personnel to remove or a unit offline scenario; returns original vs. degraded readiness per unit and recommended recovery actions.

---

## API Reference (key endpoints)

```
GET  /api/dashboard/summary          — overall readiness, alerts, incidents, station summaries
GET  /api/alerts                     — all alerts (filter by ?state=OPEN|ACKNOWLEDGED|RESOLVED)
POST /api/alerts/{id}/acknowledge    — acknowledge with actor and note
POST /api/alerts/{id}/resolve        — resolve alert
GET  /api/stations                   — station list
GET  /api/incidents                  — active operational incidents
GET  /api/recommendations            — rules-based recommendations (optional ?unit_id=)
GET  /api/analytics/readiness-trends — 14-day readiness by station
GET  /api/analytics/certification-risk — cert risk rows expiring within 90 days
GET  /api/analytics/staffing-gaps    — staffing gap by unit
POST /api/simulations/staffing-gap   — what-if simulation
POST /api/demo/reset                 — reset and re-seed Ridgecrest demo data
GET  /api/readiness/units            — live unit readiness scores
GET  /api/personnel                  — personnel list
GET  /api/certifications/expiring    — certs expiring within N days
```

Full Swagger docs at `http://localhost:8000/docs`.

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- (Optional) Confluent Kafka credentials
- (Optional) Snowflake account

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Demo data seeds automatically on startup. Reset at any time:
```bash
curl -X POST http://localhost:8000/api/demo/reset
```

### Frontend

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
1. RAW schema tables (SHIFT_EVENTS, PERSONNEL, UNITS, UNIT_ASSIGNMENTS)
2. Snowpipe ingestion from Kafka
3. Streams and Tasks for automated ETL
4. ANALYTICS views (SHIFT_COVERAGE_HOURLY, UNIT_READINESS_AGGREGATES)

See [SNOWFLAKE_SETUP.md](./SNOWFLAKE_SETUP.md) for configuration steps.

---

## Project Structure

```
├── backend/
│   └── app/
│       ├── api/           # REST routes (shifts, readiness, operations)
│       ├── services/      # Readiness, certification, recommendation, demo, Kafka, Snowflake
│       ├── websocket/     # WebSocket connection managers
│       ├── models.py      # Pydantic domain models
│       ├── stores.py      # In-memory data stores
│       └── main.py        # FastAPI app, startup seed, WebSocket endpoints
├── dashboard/
│   └── app/
│       ├── page.tsx                       # Overview (hero + live stats + alerts)
│       ├── readiness/page.tsx             # Operations board
│       ├── personnel/page.tsx             # Workforce workspace
│       ├── shifts/page.tsx                # Shift operations
│       ├── analytics/page.tsx             # Analytics suite
│       └── certifications-management/    # Credentials library
└── data-pipeline/
    └── snowflake/                         # SQL pipeline scripts
```

---

## License

MIT © Devon Arnone
