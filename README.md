# Emergency Services Crew Readiness Dashboard

A mission-critical real-time platform for monitoring Fire, EMS, and Search & Rescue crew readiness, staffing levels, certification compliance, and unit assignments with live WebSocket updates and Snowflake-powered analytics.

## 🏗️ Architecture Overview

This project demonstrates a production-ready architecture combining:
- **Real-time updates** via WebSockets
- **Event streaming** with Kafka (Confluent Cloud)
- **Data warehousing & analytics** with Snowflake
- **Modern web stack** (FastAPI + Next.js)

See [docs/architecture.md](./docs/architecture.md) for detailed architecture diagrams and flow descriptions.

## 🛠️ Tech Stack

### Backend
- **FastAPI** (Python) - REST API and WebSocket server
- **Kafka** (Confluent Cloud) - Event streaming
- **Snowflake** - Data warehouse and analytics
- **SQLite** (development) - Local data persistence

### Frontend
- **Next.js 14** (TypeScript) - React dashboard
- **WebSocket Client** - Real-time updates
- **Chart.js / Recharts** - Analytics visualizations

### Data Pipeline
- **Snowflake Streams & Tasks** - Automated data transformation
- **Snowpipe** (optional) - Automated data ingestion

## 🚀 Quick Start

See [SETUP.md](./SETUP.md) for detailed setup instructions.

**Quick commands:**
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd dashboard
npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev
```

Open **http://localhost:3000** to see the dashboard!

**Note:** The app works with mock Kafka/Snowflake services for development. See [SETUP.md](./SETUP.md) for configuring real services.

## 📁 Project Structure

```
workforce-shift-dashboard/
├── backend/
│   ├── app/
│   │   ├── api/          # REST API routers
│   │   ├── models/       # Pydantic models
│   │   ├── services/     # Business logic (Kafka, Snowflake)
│   │   └── websocket/    # WebSocket manager
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── data-pipeline/
│   └── snowflake/
│       ├── 01_schema.sql
│       ├── 02_stage_and_pipe.sql
│       ├── 03_streams_and_tasks.sql
│       └── 04_analytics_views.sql
├── dashboard/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── package.json
│   └── .env.example
└── docs/
    └── architecture.md
```

## 🔑 Environment Variables

### Backend (.env)
```bash
# Kafka (Confluent Cloud)
KAFKA_BOOTSTRAP_SERVERS=pkc-xxxxx.region.provider.confluent.cloud:9092
KAFKA_USERNAME=your_api_key
KAFKA_PASSWORD=your_api_secret

# Snowflake
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_user
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_ROLE=ACCOUNTADMIN
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=WORKFORCE_DB
SNOWFLAKE_SCHEMA=RAW

# Application
JWT_SECRET=your-secret-key
CORS_ORIGINS=http://localhost:3000,https://your-frontend.vercel.app
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## 🚢 Deployment

### Backend (Render/Railway)

1. Push code to GitHub
2. Create new service in Render/Railway
3. Connect GitHub repository
4. Set build command: `cd backend && pip install -r requirements.txt`
5. Set start command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Configure all environment variables
7. Deploy

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in Vercel (select `dashboard/` folder)
3. Set environment variable: `NEXT_PUBLIC_API_BASE_URL=https://your-backend.onrender.com`
4. Deploy

## 📊 Key Features

- **Real-time Crew Readiness Monitoring**: WebSocket-based live updates for unit staffing and readiness scores
- **Certification Tracking**: Automated expiration alerts and compliance monitoring
- **Event-Driven Architecture**: Kafka integration for scalable event streaming
- **Data Engineering**: Snowflake data warehouse with automated ETL via Streams & Tasks
- **Full-Stack Development**: FastAPI (Python) backend + Next.js (TypeScript) frontend
- **Production-Ready**: Environment-based configuration, cloud deployment ready

## 📝 API Endpoints

### REST API
- `POST /api/personnel` - Create personnel profile
- `GET /api/personnel` - List all personnel
- `POST /api/units` - Create unit definition
- `GET /api/units` - List all units
- `POST /api/unit-assignments` - Assign personnel to unit
- `GET /api/readiness/units/{unit_id}` - Get unit readiness status
- `GET /api/readiness/all-units` - Get all units readiness
- `GET /api/certifications/expiring` - Get expiring certifications
- `GET /api/certifications/expired` - Get expired certifications

### WebSocket
- `ws://<backend_url>/ws/unit-readiness/{unit_id}` - Real-time unit readiness updates

See http://localhost:8000/docs for full interactive API documentation.

## 📚 Documentation

- [SETUP.md](./SETUP.md) - Detailed setup and installation guide
- [SNOWFLAKE_SETUP.md](./SNOWFLAKE_SETUP.md) - Snowflake configuration and data pipeline setup
- [docs/architecture.md](./docs/architecture.md) - System architecture and design

## 🤝 Contributing

This is a portfolio project demonstrating modern data infrastructure and real-time systems. Feel free to fork and extend!

# Emergency-Service-Readiness-Dashboard
