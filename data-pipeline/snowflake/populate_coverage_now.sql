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
    WITH unit_hourly AS (
        SELECT
            DATE(ua.shift_start) as date,
            COALESCE(u.station_id, p.station_id, 'UNKNOWN') as location,
            HOUR(ua.shift_start) as hour,
            ua.unit_id,
            MAX(u.minimum_staff) as required_staff,
            COUNT(DISTINCT ua.personnel_id) as staffed_positions,
            MAX(CASE WHEN TIMESTAMPDIFF(HOUR, ua.shift_start, ua.shift_end) >= 12 THEN 1 ELSE 0 END) as overtime_risk_unit
        FROM RAW.UNIT_ASSIGNMENTS ua
        JOIN RAW.UNITS u ON ua.unit_id = u.unit_id
        LEFT JOIN RAW.PERSONNEL p ON ua.personnel_id = p.personnel_id
        WHERE DATE(ua.shift_start) >= CURRENT_DATE() - 7
        GROUP BY
            DATE(ua.shift_start),
            COALESCE(u.station_id, p.station_id, 'UNKNOWN'),
            HOUR(ua.shift_start),
            ua.unit_id
    )
    SELECT
        date,
        location,
        hour,
        SUM(required_staff) as scheduled_headcount,
        SUM(staffed_positions) as actual_headcount,
        CASE WHEN SUM(staffed_positions) < SUM(required_staff) THEN TRUE ELSE FALSE END as understaffed_flag,
        MAX(overtime_risk_unit) = 1 as overtime_risk_flag
    FROM unit_hourly
    GROUP BY date, location, hour
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
