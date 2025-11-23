-- Setup script: Create all necessary tables for the dashboard
-- Run this once to set up your Snowflake database

USE DATABASE WORKFORCE_DB;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS RAW;
CREATE SCHEMA IF NOT EXISTS ANALYTICS;

-- Create RAW tables
USE SCHEMA RAW;

CREATE OR REPLACE TABLE PERSONNEL (
    personnel_id VARCHAR(36),
    name VARCHAR(255) NOT NULL,
    rank VARCHAR(100),
    role VARCHAR(150) NOT NULL,
    certifications ARRAY,
    cert_expirations VARIANT,
    availability_status VARCHAR(25) DEFAULT 'AVAILABLE',
    last_check_in TIMESTAMP_NTZ,
    station_id VARCHAR(36),
    current_unit_id VARCHAR(36),
    notes STRING,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE UNITS (
    unit_id VARCHAR(36),
    unit_name VARCHAR(150) NOT NULL,
    type VARCHAR(25) NOT NULL,
    minimum_staff INTEGER NOT NULL,
    required_certifications ARRAY,
    station_id VARCHAR(36),
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE UNIT_ASSIGNMENTS (
    assignment_id VARCHAR(36),
    unit_id VARCHAR(36) NOT NULL,
    personnel_id VARCHAR(36) NOT NULL,
    shift_start TIMESTAMP_NTZ NOT NULL,
    shift_end TIMESTAMP_NTZ NOT NULL,
    assignment_status VARCHAR(25) DEFAULT 'ON_SHIFT',
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Create ANALYTICS table
USE SCHEMA ANALYTICS;

CREATE OR REPLACE TABLE SHIFT_COVERAGE_HOURLY (
    date DATE NOT NULL,
    location VARCHAR(100) NOT NULL,
    hour INTEGER NOT NULL,
    scheduled_headcount INTEGER DEFAULT 0,
    actual_headcount INTEGER DEFAULT 0,
    understaffed_flag BOOLEAN DEFAULT FALSE,
    overtime_risk_flag BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Verify tables were created
SELECT 'Setup complete!' as status;

