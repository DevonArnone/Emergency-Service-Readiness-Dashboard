# Setup Guide - Getting Started

Follow these steps to get the Emergency Services Crew Readiness Dashboard running locally.

## Prerequisites

- Python 3.11+ installed
- Node.js 18+ installed
- (Optional) Snowflake account (free trial: https://signup.snowflake.com) - See [SNOWFLAKE_SETUP.md](./SNOWFLAKE_SETUP.md)
- (Optional) Confluent Cloud account (free tier: https://www.confluent.io/confluent-cloud/tryfree/)

## Quick Start

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with placeholder values (app works with mock services)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend (new terminal):**
```bash
cd dashboard
npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev
```

Open **http://localhost:3000** to see the dashboard!

## Step 1: Backend Setup

### 1.1 Create Virtual Environment

```bash
cd backend
python -m venv venv
```

### 1.2 Activate Virtual Environment

**macOS/Linux:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

### 1.3 Install Dependencies

```bash
pip install -r requirements.txt
```

### 1.4 Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your text editor
# For now, you can use placeholder values - the app will use mock services
```

**Minimum .env configuration for local development (without Kafka/Snowflake):**

```bash
# Kafka (use placeholder values - will use mock service)
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_USERNAME=placeholder
KAFKA_PASSWORD=placeholder
KAFKA_TOPIC=shift_events

# Snowflake (use placeholder values - will use mock service)
SNOWFLAKE_ACCOUNT=placeholder
SNOWFLAKE_USER=placeholder
SNOWFLAKE_PASSWORD=placeholder
SNOWFLAKE_ROLE=ACCOUNTADMIN
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=WORKFORCE_DB
SNOWFLAKE_SCHEMA=RAW

# Application
JWT_SECRET=dev-secret-key-change-in-production
CORS_ORIGINS=http://localhost:3000
DATABASE_URL=sqlite+aiosqlite:///./workforce.db

# Server
HOST=0.0.0.0
PORT=8000
```

### 1.5 Start the Backend Server

**Option 1: Direct Start (Recommended)**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Option 2: Use Start Script**
```bash
./start_server.sh
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

**Note:** The server is a long-running process that blocks the terminal. This is normal - keep this terminal open! The server will auto-reload on code changes. Use a separate terminal for other commands.

### 1.6 Test the Backend

Open a new terminal and test:

```bash
# Health check
curl http://localhost:8000/health

# Should return: {"status":"healthy"}

# API docs
# Open in browser: http://localhost:8000/docs
```

## Step 2: Frontend Setup

### 2.1 Install Dependencies

Open a **new terminal** (keep backend running):

```bash
cd dashboard
npm install
```

### 2.2 Configure Environment Variables

```bash
# Create .env.local file
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local
```

Or manually create `.env.local`:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 2.3 Start the Frontend Server

```bash
npm run dev
```

You should see:
```
  ▲ Next.js 14.0.4
  - Local:        http://localhost:3000
```

### 2.4 Open the Dashboard

Open your browser to: **http://localhost:3000**

You should see the Workforce & Shift Management Dashboard homepage!

## Step 3: Test the System

### 3.1 Create an Employee

Using the API docs at http://localhost:8000/docs, or via curl:

```bash
curl -X POST "http://localhost:8000/api/employees" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "role": "Manager",
    "location": "Store A"
  }'
```

Save the `employee_id` from the response.

### 3.2 Create a Shift

```bash
curl -X POST "http://localhost:8000/api/shifts" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "Store A",
    "start_time": "2024-01-15T09:00:00",
    "end_time": "2024-01-15T17:00:00",
    "required_headcount": 3
  }'
```

Save the `shift_id` from the response.

### 3.3 Assign Employee to Shift

```bash
curl -X POST "http://localhost:8000/api/shifts/{shift_id}/assign?employee_id={employee_id}"
```

Replace `{shift_id}` and `{employee_id}` with the IDs from above.

### 3.4 Clock In

```bash
curl -X POST "http://localhost:8000/api/shifts/{shift_id}/clock-in" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "{employee_id}"
  }'
```

### 3.5 View Live Shifts

1. Go to http://localhost:3000/shifts
2. You should see your shift with real-time status
3. Open the browser console to see WebSocket messages

## Step 4: (Optional) Set Up Real Services

### 4.1 Set Up Kafka (Confluent Cloud)

1. Sign up at https://www.confluent.io/confluent-cloud/tryfree/
2. Create a Kafka cluster
3. Create a topic: `shift_events`
4. Create an API key/secret
5. Update `backend/.env`:
   ```bash
   KAFKA_BOOTSTRAP_SERVERS=pkc-xxxxx.region.provider.confluent.cloud:9092
   KAFKA_USERNAME=your_api_key
   KAFKA_PASSWORD=your_api_secret
   ```
6. Restart the backend server

### 4.2 Set Up Snowflake

1. Sign up at https://signup.snowflake.com
2. Create a database and run the SQL scripts in order:
   - `data-pipeline/snowflake/01_schema.sql`
   - `data-pipeline/snowflake/02_stage_and_pipe.sql`
   - `data-pipeline/snowflake/03_streams_and_tasks.sql`
   - `data-pipeline/snowflake/04_analytics_views.sql`
3. Create a user/role for the backend
4. Update `backend/.env`:
   ```bash
   SNOWFLAKE_ACCOUNT=your_account
   SNOWFLAKE_USER=your_user
   SNOWFLAKE_PASSWORD=your_password
   SNOWFLAKE_ROLE=YOUR_ROLE
   SNOWFLAKE_WAREHOUSE=YOUR_WAREHOUSE
   SNOWFLAKE_DATABASE=WORKFORCE_DB
   SNOWFLAKE_SCHEMA=RAW
   ```
5. Restart the backend server

## Troubleshooting

### Backend won't start

- **Port 8000 already in use**: Change `PORT=8001` in `.env` and update frontend `.env.local`
- **Import errors**: Make sure virtual environment is activated and dependencies are installed
- **Kafka/Snowflake connection errors**: The app will use mock services if connection fails - this is fine for development

### Frontend won't start

- **Port 3000 already in use**: Next.js will automatically use 3001
- **Module not found**: Run `npm install` again
- **API connection errors**: Check that backend is running on port 8000

### WebSocket not connecting

- Check browser console for errors
- Verify `NEXT_PUBLIC_API_BASE_URL` is set correctly
- Check backend CORS settings allow `http://localhost:3000`
- Ensure backend WebSocket endpoint is accessible

### No data in Analytics page

- Analytics require Snowflake to be set up
- For now, the page will show "No analytics data available"
- This is expected if using mock Snowflake service

## Quick Test Script

Save this as `test-api.sh` and run it:

```bash
#!/bin/bash

BASE_URL="http://localhost:8000"

echo "Creating employee..."
EMPLOYEE=$(curl -s -X POST "$BASE_URL/api/employees" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Employee","role":"Staff","location":"Store A"}')
EMPLOYEE_ID=$(echo $EMPLOYEE | grep -o '"employee_id":"[^"]*' | cut -d'"' -f4)
echo "Employee ID: $EMPLOYEE_ID"

echo "Creating shift..."
SHIFT=$(curl -s -X POST "$BASE_URL/api/shifts" \
  -H "Content-Type: application/json" \
  -d '{"location":"Store A","start_time":"2024-01-15T09:00:00","end_time":"2024-01-15T17:00:00","required_headcount":2}')
SHIFT_ID=$(echo $SHIFT | grep -o '"shift_id":"[^"]*' | cut -d'"' -f4)
echo "Shift ID: $SHIFT_ID"

echo "Assigning employee..."
curl -s -X POST "$BASE_URL/api/shifts/$SHIFT_ID/assign?employee_id=$EMPLOYEE_ID"

echo "Clock in..."
curl -s -X POST "$BASE_URL/api/shifts/$SHIFT_ID/clock-in" \
  -H "Content-Type: application/json" \
  -d "{\"employee_id\":\"$EMPLOYEE_ID\"}"

echo "Getting live shifts..."
curl -s "$BASE_URL/api/shifts/live" | python -m json.tool

echo "Done! Check http://localhost:3000/shifts"
```

Make it executable: `chmod +x test-api.sh`

## Next Steps

Once everything is running:

1. **Explore the API**: Visit http://localhost:8000/docs for interactive API documentation
2. **Test Real-time Updates**: Open http://localhost:3000/readiness in multiple browser tabs and watch live updates
3. **Check WebSocket**: Open browser DevTools → Network → WS to see WebSocket messages
4. **Review Architecture**: Read `docs/architecture.md` to understand the system design
5. **Set Up Snowflake**: See [SNOWFLAKE_SETUP.md](./SNOWFLAKE_SETUP.md) for analytics and data warehousing

## Need Help?

- Check the logs in both terminal windows
- Review error messages - they're usually descriptive
- The mock services (Kafka/Snowflake) will log `[MOCK]` messages - this is normal
- All services gracefully degrade if external dependencies aren't available

Happy coding! 🚀

