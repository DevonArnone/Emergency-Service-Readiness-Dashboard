-- Quick check to see what data exists in Snowflake
-- Run this in Snowflake to verify data is being inserted

USE DATABASE WORKFORCE_DB;

-- Check personnel data
SELECT COUNT(*) as personnel_count FROM RAW.PERSONNEL;
SELECT * FROM RAW.PERSONNEL LIMIT 5;

-- Check units data
SELECT COUNT(*) as units_count FROM RAW.UNITS;
SELECT * FROM RAW.UNITS LIMIT 5;

-- Check unit assignments data
SELECT COUNT(*) as assignments_count FROM RAW.UNIT_ASSIGNMENTS;
SELECT * FROM RAW.UNIT_ASSIGNMENTS LIMIT 5;

-- Check if coverage data exists
SELECT COUNT(*) as coverage_count FROM ANALYTICS.SHIFT_COVERAGE_HOURLY;
SELECT * FROM ANALYTICS.SHIFT_COVERAGE_HOURLY 
WHERE date >= CURRENT_DATE() - 7
ORDER BY date DESC, hour DESC
LIMIT 10;

-- Check task status
SHOW TASKS;

