-- Add task to populate SHIFT_COVERAGE_HOURLY from UNIT_ASSIGNMENTS
-- Run this in Snowflake to enable analytics for unit assignments

USE DATABASE WORKFORCE_DB;
USE SCHEMA ANALYTICS;

-- Task to populate SHIFT_COVERAGE_HOURLY from UNIT_ASSIGNMENTS
-- This creates hourly coverage analytics from emergency services unit assignments
CREATE OR REPLACE TASK process_unit_coverage_task
    WAREHOUSE = COMPUTE_WH
    SCHEDULE = '5 MINUTE'
    AS
    -- Populate coverage analytics from unit assignments
    MERGE INTO ANALYTICS.SHIFT_COVERAGE_HOURLY AS target
    USING (
        WITH active_assignments AS (
            -- Get all active unit assignments
            SELECT
                ua.unit_id,
                ua.personnel_id,
                ua.shift_start,
                ua.shift_end,
                ua.assignment_status,
                COALESCE(u.station_id, p.station_id, 'UNKNOWN') as location,
                u.minimum_staff
            FROM RAW.UNIT_ASSIGNMENTS ua
            JOIN RAW.UNITS u ON ua.unit_id = u.unit_id
            LEFT JOIN RAW.PERSONNEL p ON ua.personnel_id = p.personnel_id
            WHERE ua.assignment_status = 'ON_SHIFT'
                AND DATE(ua.shift_start) >= DATEADD(day, -7, CURRENT_DATE())
        ),
        hourly_breakdown AS (
            -- Break down assignments by hour (simplified - use shift start hour)
            SELECT
                DATE(shift_start) as coverage_date,
                location,
                HOUR(shift_start) as hour,
                unit_id,
                personnel_id,
                minimum_staff
            FROM active_assignments
            WHERE HOUR(shift_start) >= 0 AND HOUR(shift_start) < 24
        ),
        hourly_aggregates AS (
            SELECT
                coverage_date as date,
                location,
                hour,
                COUNT(DISTINCT unit_id) as scheduled_headcount,
                COUNT(DISTINCT personnel_id) as actual_headcount,
                SUM(minimum_staff) as total_required
            FROM hourly_breakdown
            GROUP BY coverage_date, location, hour
        )
        SELECT
            date,
            location,
            hour,
            scheduled_headcount,
            actual_headcount,
            CASE 
                WHEN actual_headcount < total_required THEN TRUE 
                ELSE FALSE 
            END as understaffed_flag,
            FALSE as overtime_risk_flag
        FROM hourly_aggregates
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

-- Resume the task
ALTER TASK process_unit_coverage_task RESUME;

-- Check task status
SHOW TASKS LIKE 'process_unit_coverage_task';

