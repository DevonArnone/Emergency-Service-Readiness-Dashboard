-- Workforce & Shift Management Dashboard
-- Snowflake Schema Definition
-- Run this script first to create the database, schemas, and base tables

-- Create database
CREATE DATABASE IF NOT EXISTS WORKFORCE_DB;
USE DATABASE WORKFORCE_DB;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS RAW;
CREATE SCHEMA IF NOT EXISTS ANALYTICS;

USE SCHEMA RAW;

-- Employees table - Master data for employees
CREATE OR REPLACE TABLE EMPLOYEES (
    employee_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    hire_date TIMESTAMP_NTZ,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Shifts table - Shift definitions
CREATE OR REPLACE TABLE SHIFTS (
    shift_id VARCHAR(36) PRIMARY KEY,
    location VARCHAR(100) NOT NULL,
    start_time TIMESTAMP_NTZ NOT NULL,
    end_time TIMESTAMP_NTZ NOT NULL,
    required_headcount INTEGER NOT NULL CHECK (required_headcount > 0),
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Shift Events table - All events related to shifts (clock-ins, assignments, alerts)
-- This is the main event log that will be streamed
CREATE OR REPLACE TABLE SHIFT_EVENTS (
    event_id VARCHAR(36) PRIMARY KEY,
    shift_id VARCHAR(36) NOT NULL,
    employee_id VARCHAR(36), -- NULL for system events like ALERT_UNDERSTAFFED
    event_type VARCHAR(50) NOT NULL, -- CREATED, ASSIGNED, CLOCK_IN, CLOCK_OUT, ALERT_UNDERSTAFFED, ALERT_OVERTIME_RISK
    event_time TIMESTAMP_NTZ NOT NULL,
    payload VARIANT, -- JSON payload for additional event data
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Shift Assignments table - Many-to-many relationship between employees and shifts
CREATE OR REPLACE TABLE SHIFT_ASSIGNMENTS (
    assignment_id VARCHAR(36) PRIMARY KEY,
    shift_id VARCHAR(36) NOT NULL,
    employee_id VARCHAR(36) NOT NULL,
    assigned_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    FOREIGN KEY (shift_id) REFERENCES SHIFTS(shift_id),
    FOREIGN KEY (employee_id) REFERENCES EMPLOYEES(employee_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_shift_events_shift_id ON SHIFT_EVENTS(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_events_event_time ON SHIFT_EVENTS(event_time);
CREATE INDEX IF NOT EXISTS idx_shift_events_event_type ON SHIFT_EVENTS(event_type);
CREATE INDEX IF NOT EXISTS idx_shifts_location ON SHIFTS(location);
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON SHIFTS(start_time);

-- Comments for documentation
COMMENT ON TABLE EMPLOYEES IS 'Master employee data';
COMMENT ON TABLE SHIFTS IS 'Shift definitions with location, time, and required headcount';
COMMENT ON TABLE SHIFT_EVENTS IS 'Event log for all shift-related activities (clock-ins, assignments, alerts)';
COMMENT ON TABLE SHIFT_ASSIGNMENTS IS 'Many-to-many relationship between employees and shifts';

-- Emergency services personnel profiles
CREATE OR REPLACE TABLE PERSONNEL (
    personnel_id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rank VARCHAR(100),
    role VARCHAR(150) NOT NULL,
    certifications ARRAY, -- e.g. ['Firefighter II', 'EMT-P']
    cert_expirations VARIANT, -- {"Firefighter II": "2025-01-01"}
    availability_status VARCHAR(25) DEFAULT 'AVAILABLE',
    last_check_in TIMESTAMP_NTZ,
    station_id VARCHAR(36),
    current_unit_id VARCHAR(36),
    notes STRING,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Emergency response unit definitions
CREATE OR REPLACE TABLE UNITS (
    unit_id VARCHAR(36) PRIMARY KEY,
    unit_name VARCHAR(150) NOT NULL,
    type VARCHAR(25) NOT NULL, -- ENGINE, LADDER, RESCUE, MEDIC, SAR_TEAM
    minimum_staff INTEGER NOT NULL CHECK (minimum_staff > 0),
    required_certifications ARRAY,
    station_id VARCHAR(36),
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Mapping of personnel to units for readiness tracking
CREATE OR REPLACE TABLE UNIT_ASSIGNMENTS (
    assignment_id VARCHAR(36) PRIMARY KEY,
    unit_id VARCHAR(36) NOT NULL,
    personnel_id VARCHAR(36) NOT NULL,
    shift_start TIMESTAMP_NTZ NOT NULL,
    shift_end TIMESTAMP_NTZ NOT NULL,
    assignment_status VARCHAR(25) DEFAULT 'ON_SHIFT',
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    FOREIGN KEY (unit_id) REFERENCES UNITS(unit_id),
    FOREIGN KEY (personnel_id) REFERENCES PERSONNEL(personnel_id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_personnel_station ON PERSONNEL(station_id);
CREATE INDEX IF NOT EXISTS idx_units_station ON UNITS(station_id);
CREATE INDEX IF NOT EXISTS idx_unit_assignments_unit ON UNIT_ASSIGNMENTS(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_assignments_personnel ON UNIT_ASSIGNMENTS(personnel_id);

COMMENT ON TABLE PERSONNEL IS 'Emergency services personnel profiles with certifications and readiness state';
COMMENT ON TABLE UNITS IS 'Emergency response units with staffing requirements';
COMMENT ON TABLE UNIT_ASSIGNMENTS IS 'Assignments of personnel to units for specified shift windows';

