-- Populate coverage analytics from assignments
-- Run this script to populate SHIFT_COVERAGE_HOURLY from UNIT_ASSIGNMENTS
-- This can be run manually or scheduled as a task

USE DATABASE WORKFORCE_DB;
USE SCHEMA ANALYTICS;

-- Ensure table exists
CREATE TABLE IF NOT EXISTS SHIFT_COVERAGE_HOURLY (
    date DATE NOT NULL,
    location VARCHAR(100) NOT NULL,
    hour INTEGER NOT NULL,
    scheduled_headcount INTEGER DEFAULT 0,
    actual_headcount INTEGER DEFAULT 0,
    understaffed_flag BOOLEAN DEFAULT FALSE,
    overtime_risk_flag BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Populate coverage data from assignments
MERGE INTO ANALYTICS.SHIFT_COVERAGE_HOURLY AS target
USING (
    SELECT
        DATE(ua.shift_start) as date,
        COALESCE(u.station_id, p.station_id, 'UNKNOWN') as location,
        HOUR(ua.shift_start) as hour,
        COUNT(DISTINCT ua.unit_id) as scheduled_headcount,
        COUNT(DISTINCT ua.personnel_id) as actual_headcount,
        CASE 
            WHEN COUNT(DISTINCT ua.personnel_id) < SUM(u.minimum_staff) THEN TRUE 
            ELSE FALSE 
        END as understaffed_flag,
        FALSE as overtime_risk_flag
    FROM RAW.UNIT_ASSIGNMENTS ua
    JOIN RAW.UNITS u ON ua.unit_id = u.unit_id
    LEFT JOIN RAW.PERSONNEL p ON ua.personnel_id = p.personnel_id
    WHERE DATE(ua.shift_start) >= CURRENT_DATE() - 7
    GROUP BY 
        DATE(ua.shift_start),
        COALESCE(u.station_id, p.station_id, 'UNKNOWN'),
        HOUR(ua.shift_start)
) AS source
ON target.date = source.date
    AND target.location = source.location
    AND target.hour = source.hour
WHEN MATCHED THEN
    UPDATE SET
        scheduled_headcount = source.scheduled_headcount,
        actual_headcount = source.actual_headcount,
        understaffed_flag = source.understaffed_flag,
        overtime_risk_flag = source.overtime_risk_flag,
        last_updated = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
    INSERT (
        date, location, hour,
        scheduled_headcount, actual_headcount,
        understaffed_flag, overtime_risk_flag
    )
    VALUES (
        source.date, source.location, source.hour,
        source.scheduled_headcount, source.actual_headcount,
        source.understaffed_flag, source.overtime_risk_flag
    );

-- Check the results
SELECT 
    'Coverage Data Created' as status,
    COUNT(*) as total_rows,
    COUNT(DISTINCT date) as unique_dates
FROM SHIFT_COVERAGE_HOURLY;

-- Show all coverage data
SELECT * FROM SHIFT_COVERAGE_HOURLY 
ORDER BY date DESC, hour;

