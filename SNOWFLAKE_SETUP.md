# Snowflake Setup Guide

This guide will help you configure Snowflake for the Emergency Services Crew Readiness Dashboard.

## Quick Start (5 Minutes)

1. **Sign up**: https://signup.snowflake.com
2. **Get Account Identifier**: Click username (top right) → Copy account identifier (format: `xxxxx.yyy-zzz`)
3. **Configure Backend**: Update `backend/.env`:
   ```bash
   SNOWFLAKE_ACCOUNT=your_account_identifier
   SNOWFLAKE_USER=your_username
   SNOWFLAKE_PASSWORD=your_password
   SNOWFLAKE_ROLE=ACCOUNTADMIN
   SNOWFLAKE_WAREHOUSE=COMPUTE_WH
   SNOWFLAKE_DATABASE=WORKFORCE_DB
   SNOWFLAKE_SCHEMA=RAW
   ```
4. **Run SQL Scripts** in Snowflake Worksheets (in order):
   - `data-pipeline/snowflake/01_schema.sql`
   - `data-pipeline/snowflake/03_streams_and_tasks.sql`
   - `data-pipeline/snowflake/04_analytics_views.sql`
5. **Restart Backend** and verify connection in logs

## Prerequisites

- A Snowflake account (free trial available: https://signup.snowflake.com)
- Access to Snowflake web UI or SnowSQL CLI
- Admin privileges to create databases, schemas, and tasks

## Step 1: Get Your Snowflake Account Information

### 1.1 Sign Up for Snowflake (if needed)

1. Go to https://signup.snowflake.com
2. Choose your cloud provider (AWS, Azure, or GCP)
3. Choose your region
4. Complete the signup process

### 1.2 Find Your Account Identifier

After logging into Snowflake:

1. Click on your username (top right)
2. Your **Account Identifier** is shown in the format: `xxxxx.yyy-zzz`
   - Example: `abc12345.us-east-1`
   - This is what you'll use for `SNOWFLAKE_ACCOUNT`

### 1.3 Create a User (if needed)

If you don't have a dedicated user for the application:

1. Go to **Admin** → **Users & Roles**
2. Click **+ Account**
3. Fill in:
   - **Username**: `workforce_app` (or your choice)
   - **Password**: Create a strong password (save this!)
   - **Default Role**: `ACCOUNTADMIN` (or a custom role with sufficient privileges)
4. Click **Create User**

**Note:** Save the username and password - you'll need them for configuration.

### 1.4 Verify Your Warehouse

1. Go to **Compute** → **Warehouses**
2. Check if `COMPUTE_WH` exists (default warehouse)
3. If not, create a warehouse:
   - Name: `COMPUTE_WH`
   - Size: `X-Small` (for development)
   - Auto-suspend: `60` seconds
   - Auto-resume: `True`

## Step 2: Configure Backend Environment Variables

### 2.1 Create or Update `.env` File

In the `backend/` directory, create or update `.env`:

```bash
cd backend
touch .env  # if it doesn't exist
```

### 2.2 Add Snowflake Configuration

Edit `backend/.env` and add/update these values:

```bash
# Snowflake Configuration
SNOWFLAKE_ACCOUNT=your_account_identifier
SNOWFLAKE_USER=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_ROLE=ACCOUNTADMIN
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=WORKFORCE_DB
SNOWFLAKE_SCHEMA=RAW
```

**Example:**
```bash
SNOWFLAKE_ACCOUNT=abc12345.us-east-1
SNOWFLAKE_USER=workforce_app
SNOWFLAKE_PASSWORD=MySecurePassword123!
SNOWFLAKE_ROLE=ACCOUNTADMIN
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=WORKFORCE_DB
SNOWFLAKE_SCHEMA=RAW
```

### 2.3 Security Note

⚠️ **Never commit `.env` to version control!** It's already in `.gitignore`.

## Step 3: Set Up Snowflake Database Schema

### 3.1 Connect to Snowflake

You can use:
- **Snowflake Web UI** (recommended for beginners)
- **SnowSQL CLI**
- **VS Code Snowflake Extension**

### 3.2 Run SQL Scripts in Order

In the Snowflake UI, go to **Worksheets** and run these scripts **in order**:

#### Script 1: Schema and Tables
```sql
-- Run: data-pipeline/snowflake/01_schema.sql
-- This creates:
--   - Database: WORKFORCE_DB
--   - Schemas: RAW, ANALYTICS
--   - Tables: EMPLOYEES, SHIFTS, SHIFT_EVENTS, SHIFT_ASSIGNMENTS
--   - Tables: PERSONNEL, UNITS, UNIT_ASSIGNMENTS
```

**To run:**
1. Open `data-pipeline/snowflake/01_schema.sql` in your editor
2. Copy the entire contents
3. Paste into Snowflake Worksheet
4. Click **Run** (or press Ctrl+Enter)

#### Script 2: Streams and Tasks
```sql
-- Run: data-pipeline/snowflake/03_streams_and_tasks.sql
-- This creates:
--   - Streams for change data capture
--   - Tasks for automated processing
```

**To run:**
1. Open `data-pipeline/snowflake/03_streams_and_tasks.sql`
2. Copy and paste into Snowflake Worksheet
3. Click **Run**

**Important:** Tasks are created in `SUSPENDED` state. The script includes `ALTER TASK ... RESUME` commands, but verify they're running:

```sql
SHOW TASKS;
-- Should show all tasks with STATE = 'started'
```

#### Script 3: Analytics Views
```sql
-- Run: data-pipeline/snowflake/04_analytics_views.sql
-- This creates:
--   - UNIT_READINESS_AGGREGATES table
--   - Analytics views for reporting
```

**To run:**
1. Open `data-pipeline/snowflake/04_analytics_views.sql`
2. Copy and paste into Snowflake Worksheet
3. Click **Run**

### 3.3 Verify Setup

Run these queries to verify everything is set up:

```sql
-- Check database exists
SHOW DATABASES LIKE 'WORKFORCE_DB';

-- Check schemas
SHOW SCHEMAS IN DATABASE WORKFORCE_DB;

-- Check tables in RAW schema
SHOW TABLES IN SCHEMA WORKFORCE_DB.RAW;

-- Check streams
SHOW STREAMS IN SCHEMA WORKFORCE_DB.RAW;

-- Check tasks
SHOW TASKS IN DATABASE WORKFORCE_DB;

-- Check analytics views
SHOW VIEWS IN SCHEMA WORKFORCE_DB.ANALYTICS;
```

## Step 4: Test the Connection

### 4.1 Restart Backend

If your backend is running, restart it to load new environment variables:

```bash
# Stop the backend (Ctrl+C)
# Then restart:
cd backend
source venv/bin/activate  # if using venv
uvicorn app.main:app --reload
```

### 4.2 Check Backend Logs

Look for these messages in the backend terminal:

**✅ Success:**
```
INFO: Connected to Snowflake successfully
```

**⚠️ Mock Service (if connection fails):**
```
WARNING: Failed to connect to Snowflake: ...
INFO: [MOCK] Would insert personnel into Snowflake: ...
```

### 4.3 Test with API

Create test data and verify it appears in Snowflake:

```bash
# Create personnel
curl -X POST http://localhost:8000/api/personnel \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Firefighter",
    "role": "Firefighter",
    "certifications": ["Firefighter II"],
    "availability_status": "AVAILABLE"
  }'

# Check Snowflake
# In Snowflake UI, run:
SELECT * FROM WORKFORCE_DB.RAW.PERSONNEL;
```

### 4.4 Verify Tasks Are Running

```sql
-- Check task execution history
SELECT *
FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY())
WHERE DATABASE_NAME = 'WORKFORCE_DB'
ORDER BY SCHEDULED_TIME DESC
LIMIT 10;
```

Tasks should run every 5 minutes. After 5+ minutes, check:

```sql
-- Check if readiness aggregates are being created
SELECT * FROM WORKFORCE_DB.ANALYTICS.UNIT_READINESS_AGGREGATES;

-- Check current readiness view
SELECT * FROM WORKFORCE_DB.ANALYTICS.current_unit_readiness;
```

## Step 5: Troubleshooting

### Connection Issues

**Error: "Failed to connect to Snowflake"**

1. **Check account identifier format:**
   - Should be: `account.region` (e.g., `abc12345.us-east-1`)
   - Not: `https://abc12345.us-east-1.snowflakecomputing.com`

2. **Verify credentials:**
   ```bash
   # Test connection manually
   snowsql -a your_account -u your_user
   ```

3. **Check network/firewall:**
   - Ensure your IP is allowed in Snowflake
   - Check if VPN is blocking connection

### Task Not Running

**Tasks show as SUSPENDED:**

```sql
-- Resume all tasks
ALTER TASK WORKFORCE_DB.RAW.process_shift_events_task RESUME;
ALTER TASK WORKFORCE_DB.RAW.process_personnel_readiness_task RESUME;
ALTER TASK WORKFORCE_DB.RAW.process_unit_assignments_task RESUME;
ALTER TASK WORKFORCE_DB.RAW.process_certification_expirations_task RESUME;
```

**Tasks not executing:**

1. Check warehouse is running:
   ```sql
   SHOW WAREHOUSES;
   -- Ensure COMPUTE_WH is running
   ```

2. Check task dependencies:
   ```sql
   SHOW TASKS;
   -- Verify DEPENDS_ON relationships
   ```

3. Check task history for errors:
   ```sql
   SELECT *
   FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY())
   WHERE STATE = 'FAILED'
   ORDER BY SCHEDULED_TIME DESC;
   ```

### Data Not Appearing

**If data isn't in Snowflake:**

1. Check backend logs for errors
2. Verify `.env` file is being read:
   ```python
   # In backend, test:
   from app.config import settings
   print(settings.snowflake_account)  # Should not be "placeholder"
   ```

3. Test Snowflake connection directly:
   ```python
   import snowflake.connector
   conn = snowflake.connector.connect(
       account='your_account',
       user='your_user',
       password='your_password',
       warehouse='COMPUTE_WH',
       database='WORKFORCE_DB',
       schema='RAW'
   )
   cursor = conn.cursor()
   cursor.execute("SELECT CURRENT_VERSION()")
   print(cursor.fetchone())
   ```

## Step 6: Monitor and Maintain

### Monitor Task Execution

```sql
-- View recent task executions
SELECT 
    NAME,
    STATE,
    SCHEDULED_TIME,
    COMPLETED_TIME,
    ERROR_MESSAGE
FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY())
WHERE DATABASE_NAME = 'WORKFORCE_DB'
ORDER BY SCHEDULED_TIME DESC
LIMIT 20;
```

### Monitor Warehouse Usage

```sql
-- Check warehouse credit usage
SELECT 
    WAREHOUSE_NAME,
    START_TIME,
    END_TIME,
    CREDITS_USED
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE WAREHOUSE_NAME = 'COMPUTE_WH'
ORDER BY START_TIME DESC
LIMIT 10;
```

### View Analytics

```sql
-- Current unit readiness
SELECT * FROM WORKFORCE_DB.ANALYTICS.current_unit_readiness;

-- Certification expirations
SELECT * FROM WORKFORCE_DB.ANALYTICS.certification_expiration_summary
WHERE status IN ('EXPIRED', 'EXPIRING_SOON');

-- Station summary
SELECT * FROM WORKFORCE_DB.ANALYTICS.station_readiness_summary;

-- Historical trends
SELECT * FROM WORKFORCE_DB.ANALYTICS.readiness_trends
WHERE date >= DATEADD(day, -30, CURRENT_DATE())
ORDER BY date DESC;
```

## Quick Reference

### Environment Variables

```bash
SNOWFLAKE_ACCOUNT=account.region          # e.g., abc12345.us-east-1
SNOWFLAKE_USER=username                   # Your Snowflake username
SNOWFLAKE_PASSWORD=password               # Your Snowflake password
SNOWFLAKE_ROLE=ACCOUNTADMIN               # Role with privileges
SNOWFLAKE_WAREHOUSE=COMPUTE_WH            # Warehouse name
SNOWFLAKE_DATABASE=WORKFORCE_DB           # Database name
SNOWFLAKE_SCHEMA=RAW                      # Schema name
```

### Useful Snowflake Queries

```sql
-- Check connection
SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE();

-- List all tables
SHOW TABLES IN SCHEMA WORKFORCE_DB.RAW;

-- Check recent data
SELECT * FROM WORKFORCE_DB.RAW.PERSONNEL ORDER BY created_at DESC LIMIT 10;

-- Check task status
SHOW TASKS IN DATABASE WORKFORCE_DB;
```

## Next Steps

Once Snowflake is configured:

1. ✅ Run Phase 4 tests again to verify integration
2. ✅ Create test data via API
3. ✅ Wait 5+ minutes for tasks to run
4. ✅ Query analytics views to see results
5. ✅ Test readiness history endpoint

## Support

If you encounter issues:

1. Check backend logs for detailed error messages
2. Review Snowflake query history for SQL errors
3. Verify all SQL scripts ran successfully
4. Ensure tasks are in RESUMED state
5. Check warehouse is running and has credits

For more help, refer to:
- [Snowflake Documentation](https://docs.snowflake.com/)
- [Snowflake Community](https://community.snowflake.com/)

