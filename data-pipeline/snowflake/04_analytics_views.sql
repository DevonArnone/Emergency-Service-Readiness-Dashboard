-- Workforce & Shift Management Dashboard
-- Snowflake Analytics Views
-- Pre-aggregated views for fast dashboard queries

USE DATABASE WORKFORCE_DB;
USE SCHEMA ANALYTICS;

-- View for daily coverage summary by location
CREATE OR REPLACE VIEW daily_coverage_summary AS
SELECT
    date,
    location,
    SUM(scheduled_headcount) as total_scheduled,
    SUM(actual_headcount) as total_actual,
    SUM(CASE WHEN understaffed_flag THEN 1 ELSE 0 END) as understaffed_hours,
    SUM(CASE WHEN overtime_risk_flag THEN 1 ELSE 0 END) as overtime_risk_hours,
    AVG(actual_headcount) as avg_headcount,
    MIN(actual_headcount) as min_headcount,
    MAX(actual_headcount) as max_headcount
FROM SHIFT_COVERAGE_HOURLY
GROUP BY date, location
ORDER BY date DESC, location;

-- View for employee attendance patterns
CREATE OR REPLACE VIEW employee_attendance_summary AS
SELECT
    e.employee_id,
    e.name,
    e.location,
    e.role,
    COUNT(DISTINCT DATE(se.event_time)) as days_worked,
    COUNT(CASE WHEN se.event_type = 'CLOCK_IN' THEN 1 END) as total_clock_ins,
    COUNT(CASE WHEN se.event_type = 'CLOCK_OUT' THEN 1 END) as total_clock_outs,
    MIN(se.event_time) as first_shift,
    MAX(se.event_time) as last_shift
FROM RAW.EMPLOYEES e
LEFT JOIN RAW.SHIFT_EVENTS se ON e.employee_id = se.employee_id
WHERE se.event_type IN ('CLOCK_IN', 'CLOCK_OUT')
GROUP BY e.employee_id, e.name, e.location, e.role;

-- View for shift performance metrics
CREATE OR REPLACE VIEW shift_performance_metrics AS
SELECT
    s.shift_id,
    s.location,
    s.start_time,
    s.end_time,
    s.required_headcount,
    COUNT(DISTINCT sa.employee_id) as assigned_count,
    COUNT(DISTINCT CASE WHEN se.event_type = 'CLOCK_IN' THEN se.employee_id END) as clocked_in_count,
    CASE
        WHEN COUNT(DISTINCT CASE WHEN se.event_type = 'CLOCK_IN' THEN se.employee_id END) < s.required_headcount
        THEN 'UNDERSTAFFED'
        WHEN COUNT(DISTINCT CASE WHEN se.event_type = 'CLOCK_IN' THEN se.employee_id END) = s.required_headcount
        THEN 'FULLY_STAFFED'
        ELSE 'OVER_STAFFED'
    END as staffing_status
FROM RAW.SHIFTS s
LEFT JOIN RAW.SHIFT_ASSIGNMENTS sa ON s.shift_id = sa.shift_id
LEFT JOIN RAW.SHIFT_EVENTS se ON s.shift_id = se.shift_id
GROUP BY s.shift_id, s.location, s.start_time, s.end_time, s.required_headcount;

-- View for location-level analytics
CREATE OR REPLACE VIEW location_analytics AS
SELECT
    location,
    DATE_TRUNC('week', date) as week_start,
    COUNT(DISTINCT date) as days_tracked,
    AVG(total_scheduled) as avg_daily_scheduled,
    AVG(total_actual) as avg_daily_actual,
    AVG(understaffed_hours) as avg_understaffed_hours_per_day,
    SUM(total_scheduled) as total_scheduled_hours,
    SUM(total_actual) as total_actual_hours
FROM daily_coverage_summary
GROUP BY location, DATE_TRUNC('week', date)
ORDER BY week_start DESC, location;

-- ============================================================================
-- PHASE 4: Emergency Services Readiness Analytics
-- ============================================================================

-- Table for unit readiness aggregates (updated by tasks)
CREATE OR REPLACE TABLE UNIT_READINESS_AGGREGATES (
    unit_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    calculated_at TIMESTAMP_NTZ NOT NULL,
    unit_name VARCHAR(150) NOT NULL,
    type VARCHAR(25) NOT NULL,
    minimum_staff INTEGER NOT NULL,
    current_staff INTEGER DEFAULT 0,
    available_staff INTEGER DEFAULT 0,
    readiness_score INTEGER CHECK (readiness_score >= 0 AND readiness_score <= 100),
    missing_certifications ARRAY,
    understaffed_flag BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (unit_id, date)
);

-- View for current unit readiness (latest calculation per unit)
CREATE OR REPLACE VIEW current_unit_readiness AS
SELECT
    ura.unit_id,
    ura.unit_name,
    ura.type,
    ura.minimum_staff,
    ura.current_staff,
    ura.available_staff,
    ura.readiness_score,
    ura.missing_certifications,
    ura.understaffed_flag,
    ura.calculated_at,
    u.station_id,
    CASE
        WHEN ura.readiness_score >= 85 THEN 'READY'
        WHEN ura.readiness_score >= 60 THEN 'NEEDS_ATTENTION'
        ELSE 'CRITICAL'
    END as readiness_status
FROM UNIT_READINESS_AGGREGATES ura
JOIN RAW.UNITS u ON ura.unit_id = u.unit_id
WHERE ura.date = CURRENT_DATE()
    AND ura.calculated_at = (
        SELECT MAX(calculated_at)
        FROM UNIT_READINESS_AGGREGATES
        WHERE unit_id = ura.unit_id
            AND date = CURRENT_DATE()
    );

-- View for certification expiration tracking
CREATE OR REPLACE VIEW certification_expiration_summary AS
SELECT
    p.personnel_id,
    p.name,
    p.role,
    p.station_id,
    cert.key::STRING as certification_name,
    cert.value::STRING::TIMESTAMP_NTZ as expiration_date,
    DATEDIFF(day, CURRENT_TIMESTAMP(), cert.value::STRING::TIMESTAMP_NTZ) as days_until_expiry,
    CASE
        WHEN cert.value::STRING::TIMESTAMP_NTZ < CURRENT_TIMESTAMP() THEN 'EXPIRED'
        WHEN DATEDIFF(day, CURRENT_TIMESTAMP(), cert.value::STRING::TIMESTAMP_NTZ) <= 30 THEN 'EXPIRING_SOON'
        ELSE 'VALID'
    END as status
FROM RAW.PERSONNEL p,
LATERAL FLATTEN(INPUT => p.cert_expirations) cert
ORDER BY expiration_date ASC;

-- View for station-level readiness summary
CREATE OR REPLACE VIEW station_readiness_summary AS
SELECT
    u.station_id,
    COUNT(DISTINCT ura.unit_id) as total_units,
    COUNT(DISTINCT CASE WHEN ura.readiness_score >= 85 THEN ura.unit_id END) as ready_units,
    COUNT(DISTINCT CASE WHEN ura.readiness_score < 60 THEN ura.unit_id END) as critical_units,
    AVG(ura.readiness_score) as avg_readiness_score,
    SUM(CASE WHEN ura.understaffed_flag THEN 1 ELSE 0 END) as understaffed_units,
    MAX(ura.calculated_at) as last_calculated
FROM UNIT_READINESS_AGGREGATES ura
JOIN RAW.UNITS u ON ura.unit_id = u.unit_id
WHERE ura.date = CURRENT_DATE()
    AND u.station_id IS NOT NULL
GROUP BY u.station_id;

-- View for historical readiness trends
CREATE OR REPLACE VIEW readiness_trends AS
SELECT
    ura.date,
    ura.type,
    COUNT(DISTINCT ura.unit_id) as unit_count,
    AVG(ura.readiness_score) as avg_readiness,
    MIN(ura.readiness_score) as min_readiness,
    MAX(ura.readiness_score) as max_readiness,
    SUM(CASE WHEN ura.understaffed_flag THEN 1 ELSE 0 END) as understaffed_count,
    AVG(ura.current_staff) as avg_staffing,
    AVG(ura.minimum_staff) as avg_required_staff
FROM UNIT_READINESS_AGGREGATES ura
GROUP BY ura.date, ura.type
ORDER BY ura.date DESC, ura.type;

-- Stored procedure to recalculate readiness for all units
CREATE OR REPLACE PROCEDURE RECALCULATE_READINESS()
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
    -- This will be called by the task to force recalculation
    -- The actual logic is in the task itself
    RETURN 'Readiness recalculation triggered';
END;
$$;

-- Comments for documentation
COMMENT ON VIEW daily_coverage_summary IS 'Daily summary of shift coverage by location';
COMMENT ON VIEW employee_attendance_summary IS 'Employee attendance patterns and statistics';
COMMENT ON VIEW shift_performance_metrics IS 'Performance metrics for individual shifts';
COMMENT ON VIEW location_analytics IS 'Weekly analytics aggregated by location';
COMMENT ON TABLE UNIT_READINESS_AGGREGATES IS 'Aggregated unit readiness scores calculated by tasks';
COMMENT ON VIEW current_unit_readiness IS 'Current readiness status for all units (latest calculation)';
COMMENT ON VIEW certification_expiration_summary IS 'Summary of all certifications with expiration dates and status';
COMMENT ON VIEW station_readiness_summary IS 'Station-level readiness aggregation';
COMMENT ON VIEW readiness_trends IS 'Historical readiness trends by date and unit type';
COMMENT ON PROCEDURE RECALCULATE_READINESS IS 'Stored procedure to trigger readiness recalculation';

