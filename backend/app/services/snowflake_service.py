"""Snowflake service for data warehouse operations."""
import logging
import json
from datetime import date, datetime
from typing import List, Optional
import snowflake.connector
from app.config import settings
from app.models import ShiftEvent, CoverageSummary, Personnel, Unit, UnitAssignment

logger = logging.getLogger(__name__)


class SnowflakeService:
    """Service for interacting with Snowflake data warehouse."""
    
    def __init__(self):
        """Initialize Snowflake connection."""
        self.conn = None
        self._connect()
    
    def _connect(self):
        """Establish connection to Snowflake."""
        # Skip connection if using placeholder values
        if (settings.snowflake_account == "placeholder" or 
            settings.snowflake_user == "placeholder" or
            settings.snowflake_password == "placeholder"):
            logger.info("Snowflake not configured (using placeholder values). Using mock service.")
            self.conn = None
            return
        
        try:
            logger.info(f"Attempting to connect to Snowflake: account={settings.snowflake_account}, user={settings.snowflake_user}, database={settings.snowflake_database}, schema={settings.snowflake_schema}")
            
            # Use connection timeouts to prevent hanging
            self.conn = snowflake.connector.connect(
                account=settings.snowflake_account,
                user=settings.snowflake_user,
                password=settings.snowflake_password,
                role=settings.snowflake_role,
                warehouse=settings.snowflake_warehouse,
                database=settings.snowflake_database,
                schema=settings.snowflake_schema,
                login_timeout=10,  # 10 second login timeout
                network_timeout=10,  # 10 second network timeout
            )
            logger.info("Connected to Snowflake successfully")
            
            # Test the connection with a simple query
            cursor = self.conn.cursor()
            cursor.execute("SELECT CURRENT_DATABASE(), CURRENT_SCHEMA()")
            result = cursor.fetchone()
            cursor.close()
            logger.info(f"Snowflake connection verified - Database: {result[0]}, Schema: {result[1]}")
            
        except Exception as e:
            logger.error(f"Could not connect to Snowflake: {e}", exc_info=True)
            logger.warning("Snowflake connection failed - app will continue without Snowflake")
            self.conn = None
    
    def insert_shift_event(self, event: ShiftEvent) -> bool:
        """
        Insert a shift event into RAW.SHIFT_EVENTS table.
        
        Args:
            event: ShiftEvent to insert
            
        Returns:
            True if successful, False otherwise
        """
        if not self.conn:
            logger.warning("Snowflake connection not available, skipping insert")
            return False
        
        try:
            cursor = self.conn.cursor()
            
            # Insert into RAW.SHIFT_EVENTS
            query = """
                INSERT INTO RAW.SHIFT_EVENTS (
                    event_id,
                    shift_id,
                    employee_id,
                    event_type,
                    event_time,
                    payload
                ) VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            import json
            payload_json = json.dumps(event.payload) if event.payload else None
            
            cursor.execute(query, (
                event.event_id,
                event.shift_id,
                event.employee_id,
                event.event_type.value,
                event.event_time,
                payload_json,
            ))
            
            cursor.close()
            logger.info(f"Inserted shift event into Snowflake: {event.event_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error inserting into Snowflake: {e}")
            return False
    
    def get_shift_coverage_summary(self, target_date: date) -> List[CoverageSummary]:
        """
        Query analytics view for shift coverage summary.
        
        Args:
            target_date: Date to query coverage for
            
        Returns:
            List of CoverageSummary objects
        """
        if not self.conn:
            logger.warning("Snowflake connection not available, returning empty list")
            return []
        
        try:
            cursor = self.conn.cursor()
            
            # First, check if the table exists
            try:
                check_query = """
                    SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_SCHEMA = 'ANALYTICS' 
                    AND TABLE_NAME = 'SHIFT_COVERAGE_HOURLY'
                """
                cursor.execute(check_query)
                table_exists = cursor.fetchone()[0] > 0
                
                if not table_exists:
                    logger.warning("SHIFT_COVERAGE_HOURLY table does not exist in ANALYTICS schema")
                    cursor.close()
                    return []
            except Exception as e:
                logger.warning(f"Could not check if table exists: {e}")
            
            # Query analytics table (SHIFT_COVERAGE_HOURLY is a table, not a view)
            # Use DATE() function to ensure proper date comparison
            query = """
                SELECT 
                    location,
                    hour,
                    scheduled_headcount,
                    actual_headcount,
                    understaffed_flag,
                    overtime_risk_flag,
                    date
                FROM ANALYTICS.SHIFT_COVERAGE_HOURLY
                WHERE date = %s
                ORDER BY location, hour
            """
            
            # Convert date to string format that Snowflake expects (YYYY-MM-DD)
            date_str = target_date.isoformat()
            logger.info(f"Querying Snowflake for coverage data on date: {date_str}")
            
            try:
                cursor.execute(query, (date_str,))
                results = cursor.fetchall()
                
                logger.info(f"Retrieved {len(results)} rows from Snowflake")
                
                coverage_summaries = []
                for row in results:
                    try:
                        coverage_summaries.append(CoverageSummary(
                            location=row[0] or "UNKNOWN",
                            hour=row[1] or 0,
                            scheduled_headcount=row[2] or 0,
                            actual_headcount=row[3] or 0,
                            understaffed_flag=bool(row[4]) if row[4] is not None else False,
                            overtime_risk_flag=bool(row[5]) if row[5] is not None else False,
                            date=str(row[6]) if row[6] else target_date.isoformat(),
                        ))
                    except Exception as e:
                        logger.error(f"Error parsing coverage row: {e}, row: {row}")
                        continue
                
                cursor.close()
                logger.info(f"Successfully parsed {len(coverage_summaries)} coverage summaries")
                return coverage_summaries
                
            except Exception as query_error:
                error_msg = str(query_error)
                logger.error(f"SQL Query failed: {error_msg}")
                logger.error(f"Query was: {query}")
                logger.error(f"Parameters: date={date_str}")
                cursor.close()
                # Return empty list on query error
                return []
            
        except Exception as e:
            logger.error(f"Error querying Snowflake analytics: {e}", exc_info=True)
            return []
    
    def insert_personnel(self, personnel: Personnel) -> bool:
        """
        Insert or update personnel in RAW.PERSONNEL table.
        
        Args:
            personnel: Personnel to insert/update
            
        Returns:
            True if successful, False otherwise
        """
        if not self.conn:
            logger.warning("Snowflake connection not available, skipping insert")
            return False
        
        try:
            cursor = self.conn.cursor()
            
            # Convert certifications list and expirations dict to Snowflake-compatible format
            certs_json = json.dumps(personnel.certifications) if personnel.certifications else '[]'
            expirations_json = json.dumps({
                k: v.isoformat() if isinstance(v, datetime) else str(v)
                for k, v in personnel.cert_expirations.items()
            }) if personnel.cert_expirations else '{}'
            
            # Use MERGE for upsert (Snowflake doesn't support ON CONFLICT)
            query = """
                MERGE INTO RAW.PERSONNEL AS target
                USING (
                    SELECT 
                        %s as personnel_id,
                        %s as name,
                        %s as rank,
                        %s as role,
                        PARSE_JSON(%s) as certifications,
                        PARSE_JSON(%s) as cert_expirations,
                        %s as availability_status,
                        %s as last_check_in,
                        %s as station_id,
                        %s as current_unit_id,
                        %s as notes
                ) AS source
                ON target.personnel_id = source.personnel_id
                WHEN MATCHED THEN
                    UPDATE SET
                        name = source.name,
                        rank = source.rank,
                        role = source.role,
                        certifications = source.certifications,
                        cert_expirations = source.cert_expirations,
                        availability_status = source.availability_status,
                        last_check_in = source.last_check_in,
                        station_id = source.station_id,
                        current_unit_id = source.current_unit_id,
                        notes = source.notes,
                        updated_at = CURRENT_TIMESTAMP()
                WHEN NOT MATCHED THEN
                    INSERT (
                        personnel_id, name, rank, role, certifications,
                        cert_expirations, availability_status, last_check_in,
                        station_id, current_unit_id, notes
                    )
                    VALUES (
                        source.personnel_id, source.name, source.rank, source.role, source.certifications,
                        source.cert_expirations, source.availability_status, source.last_check_in,
                        source.station_id, source.current_unit_id, source.notes
                    )
            """
            
            cursor.execute(query, (
                personnel.personnel_id,
                personnel.name,
                personnel.rank,
                personnel.role,
                certs_json,
                expirations_json,
                personnel.availability_status.value if hasattr(personnel.availability_status, 'value') else str(personnel.availability_status),
                personnel.last_check_in,
                personnel.station_id,
                personnel.current_unit_id,
                personnel.notes,
            ))
            
            # Explicitly commit the transaction
            self.conn.commit()
            cursor.close()
            logger.info(f"Inserted/updated personnel in Snowflake: {personnel.personnel_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error inserting personnel into Snowflake: {e}")
            return False
    
    def insert_unit(self, unit: Unit) -> bool:
        """
        Insert or update unit in RAW.UNITS table.
        
        Args:
            unit: Unit to insert/update
            
        Returns:
            True if successful, False otherwise
        """
        if not self.conn:
            logger.warning("Snowflake connection not available, skipping insert")
            return False
        
        try:
            cursor = self.conn.cursor()
            
            # Convert certifications list to Snowflake-compatible format
            certs_json = json.dumps(unit.required_certifications) if unit.required_certifications else '[]'
            
            # Use MERGE for upsert
            query = """
                MERGE INTO RAW.UNITS AS target
                USING (
                    SELECT 
                        %s as unit_id,
                        %s as unit_name,
                        %s as type,
                        %s as minimum_staff,
                        PARSE_JSON(%s) as required_certifications,
                        %s as station_id
                ) AS source
                ON target.unit_id = source.unit_id
                WHEN MATCHED THEN
                    UPDATE SET
                        unit_name = source.unit_name,
                        type = source.type,
                        minimum_staff = source.minimum_staff,
                        required_certifications = source.required_certifications,
                        station_id = source.station_id,
                        updated_at = CURRENT_TIMESTAMP()
                WHEN NOT MATCHED THEN
                    INSERT (
                        unit_id, unit_name, type, minimum_staff,
                        required_certifications, station_id
                    )
                    VALUES (
                        source.unit_id, source.unit_name, source.type, source.minimum_staff,
                        source.required_certifications, source.station_id
                    )
            """
            
            cursor.execute(query, (
                unit.unit_id,
                unit.unit_name,
                unit.type.value if hasattr(unit.type, 'value') else str(unit.type),
                unit.minimum_staff,
                certs_json,
                unit.station_id,
            ))
            
            # Explicitly commit the transaction
            self.conn.commit()
            cursor.close()
            logger.info(f"Inserted/updated unit in Snowflake: {unit.unit_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error inserting unit into Snowflake: {e}")
            return False
    
    def insert_unit_assignment(self, assignment: UnitAssignment) -> bool:
        """
        Insert or update unit assignment in RAW.UNIT_ASSIGNMENTS table.
        
        Args:
            assignment: UnitAssignment to insert/update
            
        Returns:
            True if successful, False otherwise
        """
        if not self.conn:
            logger.warning("Snowflake connection not available, skipping insert")
            return False
        
        try:
            cursor = self.conn.cursor()
            
            # Use MERGE for upsert
            query = """
                MERGE INTO RAW.UNIT_ASSIGNMENTS AS target
                USING (
                    SELECT 
                        %s as assignment_id,
                        %s as unit_id,
                        %s as personnel_id,
                        %s as shift_start,
                        %s as shift_end,
                        %s as assignment_status
                ) AS source
                ON target.assignment_id = source.assignment_id
                WHEN MATCHED THEN
                    UPDATE SET
                        unit_id = source.unit_id,
                        personnel_id = source.personnel_id,
                        shift_start = source.shift_start,
                        shift_end = source.shift_end,
                        assignment_status = source.assignment_status
                WHEN NOT MATCHED THEN
                    INSERT (
                        assignment_id, unit_id, personnel_id,
                        shift_start, shift_end, assignment_status
                    )
                    VALUES (
                        source.assignment_id, source.unit_id, source.personnel_id,
                        source.shift_start, source.shift_end, source.assignment_status
                    )
            """
            
            cursor.execute(query, (
                assignment.assignment_id,
                assignment.unit_id,
                assignment.personnel_id,
                assignment.shift_start,
                assignment.shift_end,
                assignment.assignment_status.value if hasattr(assignment.assignment_status, 'value') else str(assignment.assignment_status),
            ))
            
            # Explicitly commit the transaction
            self.conn.commit()
            cursor.close()
            logger.info(f"Inserted/updated unit assignment in Snowflake: {assignment.assignment_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error inserting unit assignment into Snowflake: {e}")
            return False
    
    def get_unit_readiness_history(self, unit_id: str, days: int = 7) -> List[dict]:
        """
        Query readiness history for a unit.
        
        Args:
            unit_id: Unit ID to query
            days: Number of days of history to retrieve
            
        Returns:
            List of readiness records
        """
        if not self.conn:
            logger.warning("Snowflake connection not available, returning empty list")
            return []
        
        try:
            cursor = self.conn.cursor()
            
            query = """
                SELECT 
                    date,
                    calculated_at,
                    current_staff,
                    available_staff,
                    readiness_score,
                    understaffed_flag,
                    missing_certifications
                FROM ANALYTICS.UNIT_READINESS_AGGREGATES
                WHERE unit_id = %s
                    AND date >= DATEADD(day, -%s, CURRENT_DATE())
                ORDER BY date DESC, calculated_at DESC
            """
            
            cursor.execute(query, (unit_id, days))
            results = cursor.fetchall()
            
            history = []
            for row in results:
                history.append({
                    'date': row[0],
                    'calculated_at': row[1],
                    'current_staff': row[2],
                    'available_staff': row[3],
                    'readiness_score': row[4],
                    'understaffed_flag': row[5],
                    'missing_certifications': json.loads(row[6]) if row[6] else [],
                })
            
            cursor.close()
            return history
            
        except Exception as e:
            logger.error(f"Error querying unit readiness history: {e}")
            return []
    
    def populate_coverage_from_assignments(self) -> bool:
        """
        Manually populate SHIFT_COVERAGE_HOURLY from UNIT_ASSIGNMENTS.
        This is a fallback if the task hasn't run yet.
        
        Returns:
            True if successful, False otherwise
        """
        if not self.conn:
            logger.warning("Snowflake connection not available")
            return False
        
        try:
            cursor = self.conn.cursor()
            
            # Use the same logic as the task
            query = """
                MERGE INTO ANALYTICS.SHIFT_COVERAGE_HOURLY AS target
                USING (
                    WITH active_assignments AS (
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
                    )
            """
            
            cursor.execute(query)
            # Explicitly commit the transaction
            self.conn.commit()
            cursor.close()
            logger.info("Successfully populated coverage data from unit assignments")
            return True
            
        except Exception as e:
            logger.error(f"Error populating coverage data: {e}", exc_info=True)
            return False
    
    def close(self):
        """Close Snowflake connection."""
        if self.conn:
            self.conn.close()
            self.conn = None


# Global instance
snowflake_service: Optional[SnowflakeService] = None


def get_snowflake_service() -> SnowflakeService:
    """Get or create Snowflake service instance (lazy initialization)."""
    global snowflake_service
    if snowflake_service is None:
        try:
            # Only create real service if not using placeholders
            if (settings.snowflake_account == "placeholder" or 
                settings.snowflake_user == "placeholder" or
                settings.snowflake_password == "placeholder"):
                # Use mock service immediately if not configured
                snowflake_service = MockSnowflakeService()
            else:
                # Try to create real service (with timeout protection)
                snowflake_service = SnowflakeService()
        except Exception as e:
            logger.warning(f"Failed to initialize Snowflake service: {e}")
            # Return a mock service on any error
            snowflake_service = MockSnowflakeService()
    return snowflake_service


class MockSnowflakeService:
    """Mock Snowflake service for development when Snowflake is not available."""
    
    def insert_shift_event(self, event: ShiftEvent) -> bool:
        """Mock insert that just logs."""
        logger.info(f"[MOCK] Would insert event into Snowflake: {event.event_id}")
        return True
    
    def get_shift_coverage_summary(self, target_date: date) -> List[CoverageSummary]:
        """Mock query that returns empty list."""
        logger.info(f"[MOCK] Would query Snowflake for date: {target_date}")
        return []
    
    def insert_personnel(self, personnel: Personnel) -> bool:
        """Mock insert that just logs."""
        logger.info(f"[MOCK] Would insert personnel into Snowflake: {personnel.personnel_id}")
        return True
    
    def insert_unit(self, unit: Unit) -> bool:
        """Mock insert that just logs."""
        logger.info(f"[MOCK] Would insert unit into Snowflake: {unit.unit_id}")
        return True
    
    def insert_unit_assignment(self, assignment: UnitAssignment) -> bool:
        """Mock insert that just logs."""
        logger.info(f"[MOCK] Would insert unit assignment into Snowflake: {assignment.assignment_id}")
        return True
    
    def get_unit_readiness_history(self, unit_id: str, days: int = 7) -> List[dict]:
        """Mock query that returns empty list."""
        logger.info(f"[MOCK] Would query unit readiness history for: {unit_id}")
        return []
    
    def close(self):
        """Mock close."""
        pass

