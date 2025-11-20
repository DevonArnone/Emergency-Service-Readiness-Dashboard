-- Workforce & Shift Management Dashboard
-- Snowflake Stage and Snowpipe Configuration
-- Optional: Use this if you want to ingest data from Kafka via Snowpipe
-- Alternative: Direct inserts from FastAPI (simpler for MVP)

USE DATABASE WORKFORCE_DB;
USE SCHEMA RAW;

-- Create an external stage for Kafka (if using Snowpipe with Kafka connector)
-- Note: This requires Snowpipe with Kafka connector setup in Snowflake
-- For MVP, you can skip this and use direct inserts from FastAPI

-- Example: Internal stage for file-based ingestion (alternative approach)
CREATE OR REPLACE STAGE IF NOT EXISTS shift_events_stage
    FILE_FORMAT = (TYPE = 'JSON');

-- Create Snowpipe (if using file-based ingestion from Kafka)
-- This would be configured to automatically load files from the stage
-- For now, we'll use direct inserts, so this is optional

-- Example Snowpipe definition (commented out - configure based on your setup):
/*
CREATE OR REPLACE PIPE shift_events_pipe
AUTO_INGEST = TRUE
AS
COPY INTO RAW.SHIFT_EVENTS
FROM @shift_events_stage
FILE_FORMAT = (TYPE = 'JSON')
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
*/

-- For MVP: We'll use direct INSERT statements from FastAPI
-- This file serves as documentation for future Snowpipe setup

COMMENT ON STAGE shift_events_stage IS 'Stage for shift events data ingestion (optional - using direct inserts for MVP)';

