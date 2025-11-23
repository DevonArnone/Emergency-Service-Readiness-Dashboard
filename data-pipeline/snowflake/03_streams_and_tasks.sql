-- Workforce & Shift Management Dashboard
-- Snowflake Streams and Tasks for Automated ETL
-- This creates a stream on SHIFT_EVENTS and a task that processes new events

USE DATABASE WORKFORCE_DB;
USE SCHEMA RAW;

CREATE OR REPLACE STREAM shift_events_stream ON TABLE SHIFT_EVENTS;

-- New streams for emergency readiness data
CREATE OR REPLACE STREAM personnel_status_stream ON TABLE PERSONNEL;
CREATE OR REPLACE STREAM certification_updates_stream ON TABLE PERSONNEL;
CREATE OR REPLACE STREAM unit_assignments_stream ON TABLE UNIT_ASSIGNMENTS;
CREATE OR REPLACE STREAM units_stream ON TABLE UNITS;

-- Switch to ANALYTICS schema for the target table
USE SCHEMA ANALYTICS;

-- Create the target table for hourly coverage analytics
-- This will be updated by the task
CREATE OR REPLACE TABLE SHIFT_COVERAGE_HOURLY (
    date DATE NOT NULL,
    location VARCHAR(100) NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour < 24),
    scheduled_headcount INTEGER DEFAULT 0,
    actual_headcount INTEGER DEFAULT 0,
    understaffed_flag BOOLEAN DEFAULT FALSE,
    overtime_risk_flag BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (date, location, hour)
);

-- Create or replace the task that processes the stream
-- This task runs every 5 minutes and processes new events
CREATE OR REPLACE TASK process_shift_events_task
    WAREHOUSE = COMPUTE_WH
    SCHEDULE = '5 MINUTE'
    AS
    -- Process new events from the stream
    MERGE INTO ANALYTICS.SHIFT_COVERAGE_HOURLY AS target
    USING (
        WITH event_data AS (
            SELECT
                DATE(se.event_time) as event_date,
                s.location,
                HOUR(se.event_time) as event_hour,
                se.event_type,
                se.employee_id,
                se.shift_id
            FROM RAW.shift_events_stream se
            JOIN RAW.SHIFTS s ON se.shift_id = s.shift_id
            WHERE se.event_type IN ('CLOCK_IN', 'CLOCK_OUT', 'ASSIGNED', 'CREATED')
        ),
        clock_ins AS (
            SELECT
                event_date,
                location,
                event_hour,
                COUNT(DISTINCT employee_id) as clocked_in_count
            FROM event_data
            WHERE event_type = 'CLOCK_IN'
            GROUP BY event_date, location, event_hour
        ),
        scheduled AS (
            SELECT
                DATE(s.start_time) as shift_date,
                s.location,
                HOUR(s.start_time) as shift_hour,
                COUNT(DISTINCT sa.employee_id) as scheduled_count,
                s.required_headcount
            FROM RAW.SHIFTS s
            LEFT JOIN RAW.SHIFT_ASSIGNMENTS sa ON s.shift_id = sa.shift_id
            GROUP BY shift_date, s.location, shift_hour, s.required_headcount
        )
        SELECT
            COALESCE(ci.event_date, sc.shift_date) as date,
            COALESCE(ci.location, sc.location) as location,
            COALESCE(ci.event_hour, sc.shift_hour) as hour,
            COALESCE(sc.scheduled_count, 0) as scheduled_headcount,
            COALESCE(ci.clocked_in_count, 0) as actual_headcount,
            (COALESCE(ci.clocked_in_count, 0) < COALESCE(sc.required_headcount, 0)) as understaffed_flag,
            FALSE as overtime_risk_flag -- TODO: Calculate based on employee hours
        FROM clock_ins ci
        FULL OUTER JOIN scheduled sc
            ON ci.event_date = sc.shift_date
            AND ci.location = sc.location
            AND ci.event_hour = sc.shift_hour
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

-- Resume the task (tasks are created in SUSPENDED state by default)
ALTER TASK process_shift_events_task RESUME;

-- ============================================================================
-- PHASE 4: Emergency Services Readiness Analytics Tasks
-- ============================================================================

-- Task to process personnel status changes and update readiness aggregates
CREATE OR REPLACE TASK process_personnel_readiness_task
    WAREHOUSE = COMPUTE_WH
    SCHEDULE = '5 MINUTE'
    AS
    -- Update readiness aggregates when personnel status changes
    MERGE INTO ANALYTICS.UNIT_READINESS_AGGREGATES AS target
    USING (
        WITH current_assignments AS (
            SELECT DISTINCT
                ua.unit_id,
                ua.assignment_status,
                ua.shift_start,
                ua.shift_end,
                p.personnel_id,
                p.availability_status,
                p.certifications,
                p.cert_expirations,
                u.unit_name,
                u.type,
                u.minimum_staff,
                u.required_certifications
            FROM RAW.UNIT_ASSIGNMENTS ua
            JOIN RAW.PERSONNEL p ON ua.personnel_id = p.personnel_id
            JOIN RAW.UNITS u ON ua.unit_id = u.unit_id
            WHERE ua.assignment_status = 'ON_SHIFT'
                AND CURRENT_TIMESTAMP() BETWEEN ua.shift_start AND ua.shift_end
        ),
        unit_readiness AS (
            SELECT
                ca.unit_id,
                MAX(ca.unit_name) as unit_name,
                MAX(ca.type) as type,
                MAX(ca.minimum_staff) as minimum_staff,
                COUNT(DISTINCT ca.personnel_id) as current_staff,
                COUNT(DISTINCT CASE WHEN ca.availability_status = 'AVAILABLE' THEN ca.personnel_id END) as available_staff,
                -- Collect missing certifications as array
                ARRAY_AGG(DISTINCT missing_cert.cert) WITHIN GROUP (ORDER BY missing_cert.cert) FILTER (WHERE missing_cert.cert IS NOT NULL) as missing_certs
            FROM current_assignments ca
            LEFT JOIN (
                SELECT DISTINCT
                    ca2.unit_id,
                    ca2.personnel_id,
                    req_cert.value::STRING as cert
                FROM current_assignments ca2,
                LATERAL FLATTEN(INPUT => ca2.required_certifications) req_cert
                WHERE req_cert.value::STRING NOT IN (
                    SELECT cert_val.value::STRING
                    FROM LATERAL FLATTEN(INPUT => ca2.certifications) cert_val
                )
            ) missing_cert ON ca.unit_id = missing_cert.unit_id AND ca.personnel_id = missing_cert.personnel_id
            GROUP BY ca.unit_id
        )
        SELECT
            ur.unit_id,
            CURRENT_DATE() as date,
            CURRENT_TIMESTAMP() as calculated_at,
            ur.unit_name,
            ur.type,
            ur.minimum_staff,
            ur.current_staff,
            ur.available_staff,
                CASE 
                WHEN ur.current_staff >= ur.minimum_staff AND ur.available_staff >= ur.minimum_staff AND (ur.missing_certs IS NULL OR ARRAY_SIZE(ur.missing_certs) = 0)
                THEN 100
                WHEN ur.current_staff >= ur.minimum_staff AND ur.available_staff >= ur.minimum_staff
                THEN 85
                WHEN ur.current_staff >= ur.minimum_staff
                THEN 70
                WHEN ur.current_staff >= ur.minimum_staff * 0.8
                THEN 50
                ELSE 30
            END as readiness_score,
            COALESCE(ur.missing_certs, ARRAY_CONSTRUCT()) as missing_certifications,
            CASE WHEN ur.current_staff < ur.minimum_staff THEN TRUE ELSE FALSE END as understaffed_flag
        FROM unit_readiness ur
    ) AS source
    ON target.unit_id = source.unit_id
        AND target.date = source.date
    WHEN MATCHED THEN
        UPDATE SET
            calculated_at = source.calculated_at,
            current_staff = source.current_staff,
            available_staff = source.available_staff,
            readiness_score = source.readiness_score,
            missing_certifications = source.missing_certifications,
            understaffed_flag = source.understaffed_flag,
            last_updated = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN
        INSERT (
            unit_id, date, calculated_at, unit_name, type,
            minimum_staff, current_staff, available_staff,
            readiness_score, missing_certifications, understaffed_flag
        )
        VALUES (
            source.unit_id, source.date, source.calculated_at, source.unit_name, source.type,
            source.minimum_staff, source.current_staff, source.available_staff,
            source.readiness_score, source.missing_certifications, source.understaffed_flag
        );

-- Task to process unit assignment changes
-- Note: This task is dependent on process_personnel_readiness_task
-- The readiness calculation is already handled in process_personnel_readiness_task
-- This task can be used for additional processing if needed
CREATE OR REPLACE TASK process_unit_assignments_task
    WAREHOUSE = COMPUTE_WH
    SCHEDULE = '5 MINUTE'
    AFTER process_personnel_readiness_task
    AS
    -- Additional processing can be added here
    -- For now, the readiness calculation is handled by process_personnel_readiness_task
    SELECT CURRENT_TIMESTAMP() as processed_at;

-- Task to detect and log certification expirations
CREATE OR REPLACE TASK process_certification_expirations_task
    WAREHOUSE = COMPUTE_WH
    SCHEDULE = '1 HOUR'
    AS
    -- Update personnel availability status for expired certifications
    UPDATE RAW.PERSONNEL p
    SET availability_status = 'IN_TRAINING',
        updated_at = CURRENT_TIMESTAMP()
    WHERE EXISTS (
        SELECT 1
        FROM LATERAL FLATTEN(INPUT => p.cert_expirations) cert_exp
        WHERE cert_exp.value::STRING::TIMESTAMP_NTZ < CURRENT_TIMESTAMP()
            AND p.availability_status != 'IN_TRAINING'
    );

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
            -- Get all active unit assignments for today and recent days
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
            -- Break down assignments by hour
            SELECT
                DATE(shift_start) as coverage_date,
                location,
                HOUR(shift_start) + hours.hour_offset as hour,
                unit_id,
                personnel_id,
                minimum_staff
            FROM active_assignments
            CROSS JOIN (
                SELECT 0 as hour_offset UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL 
                SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL 
                SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL 
                SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL 
                SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL 
                SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23
            ) hours
            WHERE hours.hour_offset < TIMESTAMPDIFF(HOUR, shift_start, shift_end) + 1
                AND hours.hour_offset >= 0
                AND hour < 24
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

-- Resume all tasks
ALTER TASK process_personnel_readiness_task RESUME;
ALTER TASK process_unit_assignments_task RESUME;
ALTER TASK process_certification_expirations_task RESUME;
ALTER TASK process_unit_coverage_task RESUME;

-- Grant necessary permissions (adjust role as needed)
-- GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE YOUR_ROLE;
-- GRANT SELECT ON STREAM RAW.shift_events_stream TO ROLE YOUR_ROLE;
-- GRANT SELECT, INSERT, UPDATE ON TABLE ANALYTICS.SHIFT_COVERAGE_HOURLY TO ROLE YOUR_ROLE;

COMMENT ON STREAM RAW.shift_events_stream IS 'Stream capturing changes to SHIFT_EVENTS table';
COMMENT ON STREAM RAW.personnel_status_stream IS 'Personnel availability and readiness changes';
COMMENT ON STREAM RAW.certification_updates_stream IS 'Certification changes detected for personnel';
COMMENT ON STREAM RAW.unit_assignments_stream IS 'Updates to personnel-to-unit assignments';
COMMENT ON STREAM RAW.units_stream IS 'Changes to unit definitions and requirements';
COMMENT ON TABLE ANALYTICS.SHIFT_COVERAGE_HOURLY IS 'Hourly shift coverage analytics aggregated from shift events';
COMMENT ON TASK process_shift_events_task IS 'Task that processes shift events stream and updates coverage analytics every 5 minutes';
COMMENT ON TASK process_personnel_readiness_task IS 'Task that processes personnel and unit assignment changes to calculate readiness scores every 5 minutes';
COMMENT ON TASK process_unit_assignments_task IS 'Task that triggers readiness recalculation when unit assignments change';
COMMENT ON TASK process_certification_expirations_task IS 'Task that checks for expired certifications and updates personnel status every hour';
COMMENT ON TASK process_unit_coverage_task IS 'Task that processes unit assignments and populates hourly coverage analytics every 5 minutes';

