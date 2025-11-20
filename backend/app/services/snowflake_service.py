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
            # Use connection timeouts to prevent hanging
            self.conn = snowflake.connector.connect(
                account=settings.snowflake_account,
                user=settings.snowflake_user,
                password=settings.snowflake_password,
                role=settings.snowflake_role,
                warehouse=settings.snowflake_warehouse,
                database=settings.snowflake_database,
                schema=settings.snowflake_schema,
                login_timeout=5,  # 5 second login timeout
                network_timeout=5,  # 5 second network timeout
            )
            logger.info("Connected to Snowflake successfully")
        except Exception as e:
            logger.warning(f"Could not connect to Snowflake: {e}")
            logger.info("Using mock Snowflake service - app will continue without Snowflake")
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
            
            # Query analytics view
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
            
            cursor.execute(query, (target_date.isoformat(),))
            results = cursor.fetchall()
            
            coverage_summaries = []
            for row in results:
                coverage_summaries.append(CoverageSummary(
                    location=row[0],
                    hour=row[1],
                    scheduled_headcount=row[2],
                    actual_headcount=row[3],
                    understaffed_flag=row[4],
                    overtime_risk_flag=row[5],
                    date=row[6],
                ))
            
            cursor.close()
            return coverage_summaries
            
        except Exception as e:
            logger.error(f"Error querying Snowflake analytics: {e}")
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

