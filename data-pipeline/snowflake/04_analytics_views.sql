-- Emergency Readiness Dashboard
-- Snowflake analytics views aligned to the emergency-readiness data model

USE DATABASE WORKFORCE_DB;
USE SCHEMA ANALYTICS;

-- Daily coverage summary by station/location
CREATE OR REPLACE VIEW daily_coverage_summary AS
SELECT
    date,
    location,
    SUM(scheduled_headcount) AS total_scheduled,
    SUM(actual_headcount) AS total_actual,
    SUM(CASE WHEN understaffed_flag THEN 1 ELSE 0 END) AS understaffed_hours,
    SUM(CASE WHEN overtime_risk_flag THEN 1 ELSE 0 END) AS overtime_risk_hours,
    AVG(IFF(scheduled_headcount = 0, 1, actual_headcount / NULLIF(scheduled_headcount, 0))) AS avg_coverage_ratio
FROM SHIFT_COVERAGE_HOURLY
GROUP BY date, location
ORDER BY date DESC, location;

-- Weekly coverage summary for command-level rollups
CREATE OR REPLACE VIEW station_operational_summary AS
SELECT
    location,
    DATE_TRUNC('week', date) AS week_start,
    COUNT(DISTINCT date) AS tracked_days,
    SUM(total_scheduled) AS scheduled_positions,
    SUM(total_actual) AS staffed_positions,
    SUM(total_scheduled - total_actual) AS readiness_gap,
    AVG(avg_coverage_ratio) AS avg_coverage_ratio,
    SUM(understaffed_hours) AS understaffed_hours,
    SUM(overtime_risk_hours) AS overtime_risk_hours
FROM daily_coverage_summary
GROUP BY location, DATE_TRUNC('week', date)
ORDER BY week_start DESC, location;

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

-- Current unit-level readiness snapshot
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
    END AS readiness_status
FROM UNIT_READINESS_AGGREGATES ura
JOIN RAW.UNITS u ON ura.unit_id = u.unit_id
WHERE ura.date = CURRENT_DATE()
  AND ura.calculated_at = (
      SELECT MAX(inner_ura.calculated_at)
      FROM UNIT_READINESS_AGGREGATES inner_ura
      WHERE inner_ura.unit_id = ura.unit_id
        AND inner_ura.date = CURRENT_DATE()
  );

-- Certification expiration tracking tied to personnel records
CREATE OR REPLACE VIEW certification_expiration_summary AS
SELECT
    p.personnel_id,
    p.name,
    p.role,
    p.station_id,
    cert.key::STRING AS certification_name,
    cert.value::STRING::TIMESTAMP_NTZ AS expiration_date,
    DATEDIFF(day, CURRENT_TIMESTAMP(), cert.value::STRING::TIMESTAMP_NTZ) AS days_until_expiry,
    CASE
        WHEN cert.value::STRING::TIMESTAMP_NTZ < CURRENT_TIMESTAMP() THEN 'EXPIRED'
        WHEN DATEDIFF(day, CURRENT_TIMESTAMP(), cert.value::STRING::TIMESTAMP_NTZ) <= 30 THEN 'EXPIRING_SOON'
        ELSE 'VALID'
    END AS status
FROM RAW.PERSONNEL p,
LATERAL FLATTEN(INPUT => p.cert_expirations) cert
ORDER BY expiration_date ASC;

-- Unit staffing snapshot with current staffing gap and cert exposure
CREATE OR REPLACE VIEW unit_staffing_snapshot AS
WITH active_assignments AS (
    SELECT
        ua.unit_id,
        ua.personnel_id,
        ua.shift_start,
        ua.shift_end
    FROM RAW.UNIT_ASSIGNMENTS ua
    WHERE ua.assignment_status = 'ON_SHIFT'
      AND CURRENT_TIMESTAMP() BETWEEN ua.shift_start AND ua.shift_end
),
unit_personnel AS (
    SELECT
        aa.unit_id,
        COUNT(DISTINCT aa.personnel_id) AS staffed_positions,
        COUNT(DISTINCT CASE WHEN p.availability_status = 'AVAILABLE' THEN aa.personnel_id END) AS available_positions
    FROM active_assignments aa
    LEFT JOIN RAW.PERSONNEL p ON aa.personnel_id = p.personnel_id
    GROUP BY aa.unit_id
)
SELECT
    u.unit_id,
    u.unit_name,
    u.type,
    u.station_id,
    u.minimum_staff,
    COALESCE(up.staffed_positions, 0) AS staffed_positions,
    COALESCE(up.available_positions, 0) AS available_positions,
    GREATEST(u.minimum_staff - COALESCE(up.staffed_positions, 0), 0) AS staffing_gap,
    IFF(u.minimum_staff = 0, 1, COALESCE(up.staffed_positions, 0) / NULLIF(u.minimum_staff, 0)) AS staffing_ratio
FROM RAW.UNITS u
LEFT JOIN unit_personnel up ON u.unit_id = up.unit_id;

-- Station-level readiness summary
CREATE OR REPLACE VIEW station_readiness_summary AS
SELECT
    u.station_id,
    COUNT(DISTINCT ura.unit_id) AS total_units,
    COUNT(DISTINCT CASE WHEN ura.readiness_score >= 85 THEN ura.unit_id END) AS ready_units,
    COUNT(DISTINCT CASE WHEN ura.readiness_score < 60 THEN ura.unit_id END) AS critical_units,
    AVG(ura.readiness_score) AS avg_readiness_score,
    SUM(CASE WHEN ura.understaffed_flag THEN 1 ELSE 0 END) AS understaffed_units,
    MAX(ura.calculated_at) AS last_calculated
FROM UNIT_READINESS_AGGREGATES ura
JOIN RAW.UNITS u ON ura.unit_id = u.unit_id
WHERE ura.date = CURRENT_DATE()
  AND u.station_id IS NOT NULL
GROUP BY u.station_id;

-- Historical readiness trends by day and unit type
CREATE OR REPLACE VIEW readiness_trends AS
SELECT
    ura.date,
    ura.type,
    COUNT(DISTINCT ura.unit_id) AS unit_count,
    AVG(ura.readiness_score) AS avg_readiness,
    MIN(ura.readiness_score) AS min_readiness,
    MAX(ura.readiness_score) AS max_readiness,
    SUM(CASE WHEN ura.understaffed_flag THEN 1 ELSE 0 END) AS understaffed_count,
    AVG(ura.current_staff) AS avg_staffing,
    AVG(ura.minimum_staff) AS avg_required_staff
FROM UNIT_READINESS_AGGREGATES ura
GROUP BY ura.date, ura.type
ORDER BY ura.date DESC, ura.type;

-- Stored procedure hook for task orchestration
CREATE OR REPLACE PROCEDURE RECALCULATE_READINESS()
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
    RETURN 'Readiness recalculation triggered';
END;
$$;

COMMENT ON VIEW daily_coverage_summary IS 'Daily summary of coverage positions versus staffed positions by station/location';
COMMENT ON VIEW station_operational_summary IS 'Weekly command rollup of staffing gaps, coverage ratio, and overtime exposure by location';
COMMENT ON TABLE UNIT_READINESS_AGGREGATES IS 'Aggregated unit readiness scores calculated by Snowflake tasks';
COMMENT ON VIEW current_unit_readiness IS 'Latest readiness snapshot for each unit';
COMMENT ON VIEW certification_expiration_summary IS 'Certification expiration and exposure summary by person';
COMMENT ON VIEW unit_staffing_snapshot IS 'Current staffing ratio and staffing gap for each unit';
COMMENT ON VIEW station_readiness_summary IS 'Station-level readiness rollup for current day';
COMMENT ON VIEW readiness_trends IS 'Historical readiness trend by unit type and day';
COMMENT ON PROCEDURE RECALCULATE_READINESS IS 'Procedure hook used by task orchestration to recalculate readiness';
