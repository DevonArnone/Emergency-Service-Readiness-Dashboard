"""REST API endpoints for duty shifts and personnel rosters."""
import logging
import uuid
from datetime import datetime, date, time, timedelta, timezone
from typing import List
from fastapi import APIRouter, HTTPException

from app.models import (
    Employee, Personnel, Shift, ShiftAssignment, ShiftEvent,
    ClockInRequest, ClockOutRequest, LiveShiftStatus, CoverageSummary,
    UnitAssignment, AssignmentStatus, AvailabilityStatus,
)
from app.websocket.manager import websocket_manager
from app.services.snowflake_service import get_snowflake_service
from app.services.audit_service import record_audit
from app.models import EventType
from app.stores import personnel_store, shifts_store, unit_assignments_store, units_store
from app.api.readiness import _validate_assignment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["shifts"])

async def _emit_shift_event(
    shift_id: str,
    event_type: EventType,
    employee_id: str = None,
    payload: dict = None
):
    """Legacy local socket notification; relational writes own durable outbox events."""
    event = ShiftEvent(
        event_id=str(uuid.uuid4()),
        shift_id=shift_id,
        employee_id=employee_id,
        event_type=event_type,
        event_time=datetime.now(timezone.utc),
        payload=payload or {},
    )
    
    # The durable pipeline is committed with each underlying relational write.
    try:
        await websocket_manager.broadcast_event(event)
    except Exception as e:
        logger.error(f"Error broadcasting WebSocket event: {e}")


@router.post("/employees", response_model=Employee)
async def create_employee(employee: Employee):
    """Compatibility endpoint that creates a canonical personnel record."""
    personnel_id = str(uuid.uuid4())
    personnel = Personnel(
        personnel_id=personnel_id,
        name=employee.name,
        role=employee.role,
        station_id=employee.location,
        last_check_in=employee.hire_date,
    )
    personnel_store[personnel_id] = personnel
    record_audit("CREATED", "personnel", personnel_id, f"Created {personnel.name}")
    return Employee(
        employee_id=personnel_id,
        name=personnel.name,
        role=personnel.role,
        location=personnel.station_id or "Unassigned",
        hire_date=personnel.last_check_in,
    )


@router.get("/employees", response_model=List[Employee])
async def list_employees():
    """Compatibility projection of canonical personnel records."""
    return [
        Employee(
            employee_id=person.personnel_id,
            name=person.name,
            role=person.role,
            location=person.station_id or "Unassigned",
            hire_date=person.last_check_in,
        )
        for person in personnel_store.values()
        if not person.is_archived
    ]


@router.post("/shifts", response_model=Shift)
async def create_shift(shift: Shift):
    """Create a new shift."""
    shift_id = str(uuid.uuid4())
    shift.shift_id = shift_id
    if shift.end_time <= shift.start_time:
        raise HTTPException(status_code=400, detail="end_time must be after start_time")
    shift.created_at = datetime.now(timezone.utc)
    shifts_store[shift_id] = shift
    
    # Emit CREATED event
    await _emit_shift_event(shift_id, EventType.CREATED)
    record_audit("CREATED", "shift", shift_id, f"Created shift at {shift.location}")
    logger.info(f"Created shift: {shift_id} at {shift.location}")
    return shift


@router.get("/shifts", response_model=List[Shift])
async def list_shifts():
    """List all shifts."""
    return sorted(shifts_store.values(), key=lambda shift: shift.start_time)


@router.put("/shifts/{shift_id}", response_model=Shift)
async def update_shift(shift_id: str, shift: Shift):
    if shift_id not in shifts_store:
        raise HTTPException(status_code=404, detail="Shift not found")
    if shift.end_time <= shift.start_time:
        raise HTTPException(status_code=400, detail="end_time must be after start_time")
    shift.shift_id = shift_id
    shift.created_at = shift.created_at or shifts_store[shift_id].created_at
    shifts_store[shift_id] = shift
    record_audit("UPDATED", "shift", shift_id, f"Updated shift at {shift.location}")
    return shift


@router.delete("/shifts/{shift_id}", response_model=Shift)
async def cancel_shift(shift_id: str):
    shift = shifts_store.get(shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    shift.status = "CANCELLED"
    shifts_store[shift_id] = shift
    for assignment_id, assignment in list(unit_assignments_store.items()):
        if assignment.shift_id == shift_id:
            was_active = assignment.assignment_status == AssignmentStatus.ON_SHIFT and assignment.shift_start <= datetime.now(timezone.utc) < assignment.shift_end
            assignment.assignment_status = AssignmentStatus.CANCELLED
            if assignment.clocked_in_at and not assignment.clocked_out_at:
                assignment.clocked_out_at = datetime.now(timezone.utc)
            unit_assignments_store[assignment_id] = assignment
            person = personnel_store.get(assignment.personnel_id)
            if was_active and person and person.current_unit_id == assignment.unit_id:
                person.current_unit_id = None
                person.availability_status = AvailabilityStatus.AVAILABLE
                personnel_store[person.personnel_id] = person
    record_audit("CANCELLED", "shift", shift_id, f"Cancelled shift at {shift.location}")
    return shift


@router.post("/shifts/{shift_id}/assign", response_model=ShiftAssignment)
async def assign_employee_to_shift(shift_id: str, employee_id: str):
    """Compatibility endpoint for assigning personnel to a shift."""
    if shift_id not in shifts_store:
        raise HTTPException(status_code=404, detail="Shift not found")
    person = personnel_store.get(employee_id)
    if not person or person.is_archived:
        raise HTTPException(status_code=404, detail="Personnel not found")
    shift = shifts_store[shift_id]
    if shift.status == 'CANCELLED':
        raise HTTPException(status_code=409, detail='Cannot assign personnel to a cancelled shift')
    unit_id = shift.unit_id or person.current_unit_id
    if not unit_id:
        station_units = [
            unit for unit in units_store.values()
            if unit.station_id == shift.station_id and not unit.is_archived
        ]
        unit_id = station_units[0].unit_id if station_units else None
    if not unit_id:
        raise HTTPException(status_code=400, detail="Shift assignment requires a unit")
    assignment_id = str(uuid.uuid4())
    assignment = UnitAssignment(
        assignment_id=assignment_id,
        shift_id=shift_id,
        unit_id=unit_id,
        personnel_id=employee_id,
        shift_start=shift.start_time,
        shift_end=shift.end_time,
        assignment_status=AssignmentStatus.PENDING,
    )
    _validate_assignment(assignment)
    unit_assignments_store[assignment_id] = assignment
    # Emit ASSIGNED event
    await _emit_shift_event(shift_id, EventType.ASSIGNED, employee_id)
    record_audit("ASSIGNED", "shift", shift_id, f"Assigned {person.name} to {shift.location}")
    logger.info(f"Assigned employee {employee_id} to shift {shift_id}")
    return ShiftAssignment(
        assignment_id=assignment_id,
        shift_id=shift_id,
        employee_id=employee_id,
        assigned_at=datetime.now(timezone.utc),
    )


@router.post("/shifts/{shift_id}/clock-in")
async def clock_in(shift_id: str, request: ClockInRequest):
    """Clock in an employee for a shift."""
    if shift_id not in shifts_store:
        raise HTTPException(status_code=404, detail="Shift not found")
    person = personnel_store.get(request.employee_id)
    if not person or person.is_archived:
        raise HTTPException(status_code=404, detail="Personnel not found")
    assignment = next((
        candidate for candidate in unit_assignments_store.values()
        if candidate.shift_id == shift_id and candidate.personnel_id == request.employee_id
    ), None)
    if not assignment:
        raise HTTPException(status_code=404, detail="Roster assignment not found")
    shift = shifts_store[shift_id]
    if shift.status == 'CANCELLED' or assignment.assignment_status == AssignmentStatus.CANCELLED:
        raise HTTPException(status_code=409, detail='Cannot clock in to a cancelled shift')
    if not shift.start_time <= datetime.now(timezone.utc) < shift.end_time:
        raise HTTPException(status_code=409, detail='Clock-in is available only during the shift window')
    _validate_assignment(assignment, assignment.assignment_id)
    assignment.clocked_in_at = datetime.now(timezone.utc)
    assignment.clocked_out_at = None
    assignment.assignment_status = AssignmentStatus.ON_SHIFT
    unit_assignments_store[assignment.assignment_id] = assignment
    person.availability_status = AvailabilityStatus.DEPLOYED
    person.current_unit_id = assignment.unit_id
    personnel_store[person.personnel_id] = person
    # Emit CLOCK_IN event
    await _emit_shift_event(shift_id, EventType.CLOCK_IN, request.employee_id)
    current_count = len([
        roster for roster in unit_assignments_store.values()
        if roster.shift_id == shift_id and roster.clocked_in_at and not roster.clocked_out_at
    ])
    if current_count < shifts_store[shift_id].required_headcount:
        await _emit_shift_event(
            shift_id,
            EventType.ALERT_UNDERSTAFFED,
            payload={"current_count": current_count, "required": shifts_store[shift_id].required_headcount}
        )
    record_audit("CLOCKED_IN", "shift", shift_id, f"Clocked in {person.name}")
    logger.info(f"Employee {request.employee_id} clocked in to shift {shift_id}")
    return {"status": "clocked_in", "shift_id": shift_id, "employee_id": request.employee_id}


@router.post("/shifts/{shift_id}/clock-out")
async def clock_out(shift_id: str, request: ClockOutRequest):
    """Clock out an employee from a shift."""
    if shift_id not in shifts_store:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    assignment = next((
        candidate for candidate in unit_assignments_store.values()
        if candidate.shift_id == shift_id and candidate.personnel_id == request.employee_id
    ), None)
    if not assignment:
        raise HTTPException(status_code=404, detail="Roster assignment not found")
    if not assignment.clocked_in_at or assignment.clocked_out_at:
        raise HTTPException(status_code=409, detail='Personnel is not currently clocked in')
    assignment.clocked_out_at = datetime.now(timezone.utc)
    assignment.assignment_status = AssignmentStatus.EARLY_OFF
    unit_assignments_store[assignment.assignment_id] = assignment
    person = personnel_store.get(request.employee_id)
    if person:
        person.availability_status = AvailabilityStatus.AVAILABLE
        person.current_unit_id = None
        personnel_store[person.personnel_id] = person
    # Emit CLOCK_OUT event
    await _emit_shift_event(shift_id, EventType.CLOCK_OUT, request.employee_id)
    record_audit("CLOCKED_OUT", "shift", shift_id, f"Clocked out {person.name if person else request.employee_id}")
    logger.info(f"Employee {request.employee_id} clocked out from shift {shift_id}")
    return {"status": "clocked_out", "shift_id": shift_id, "employee_id": request.employee_id}


@router.get("/shifts/live", response_model=List[LiveShiftStatus])
async def get_live_shifts(target_date: date | None = None):
    """Attendance for shifts overlapping the selected UTC date, including overnight watches."""
    today = target_date or datetime.now(timezone.utc).date()
    day_start = datetime.combine(today, time.min, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    live_statuses = []
    assignments = list(unit_assignments_store.values())
    people = dict(personnel_store.items())
    units = dict(units_store.items())
    
    for shift_id, shift in shifts_store.items():
        if shift.status == 'CANCELLED' or shift.start_time >= day_end or shift.end_time <= day_start:
            continue
        
        roster = [
            assignment for assignment in assignments
            if assignment.shift_id == shift_id and assignment.assignment_status != AssignmentStatus.CANCELLED
        ]
        if not roster and shift.station_id:
            roster = [
                assignment for assignment in assignments
                if not assignment.shift_id and assignment.assignment_status != AssignmentStatus.CANCELLED
                and units.get(assignment.unit_id)
                and units[assignment.unit_id].station_id == shift.station_id
                and assignment.shift_start < shift.end_time
                and assignment.shift_end > shift.start_time
            ]
        assigned_count = len([
            assignment for assignment in roster
            if assignment.assignment_status != AssignmentStatus.CANCELLED
        ])
        clocked_in_count = len([
            assignment for assignment in roster
            if assignment.clocked_in_at and not assignment.clocked_out_at
        ])
        
        # Determine status
        if clocked_in_count < shift.required_headcount:
            status = "understaffed"
        elif clocked_in_count == shift.required_headcount:
            status = "fully_staffed"
        else:
            status = "over_staffed"
        
        alerts = []
        if status == "understaffed":
            alerts.append("Understaffed")
        
        live_status = LiveShiftStatus(
            shift_id=shift_id,
            location=shift.location,
            start_time=shift.start_time,
            end_time=shift.end_time,
            required_headcount=shift.required_headcount,
            assigned_count=assigned_count,
            clocked_in_count=clocked_in_count,
            status=status,
            alerts=alerts,
            station_id=shift.station_id,
            unit_id=shift.unit_id,
            assigned_personnel=[
                {
                    "personnel_id": assignment.personnel_id,
                    "name": people[assignment.personnel_id].name,
                    "unit_id": assignment.unit_id,
                    "status": assignment.assignment_status.value,
                    "clocked_in_at": assignment.clocked_in_at.isoformat() if assignment.clocked_in_at else None,
                    "clocked_out_at": assignment.clocked_out_at.isoformat() if assignment.clocked_out_at else None,
                }
                for assignment in roster
                if assignment.personnel_id in people
            ],
        )
        live_statuses.append(live_status)
    
    return live_statuses


@router.get("/analytics/coverage", response_model=List[CoverageSummary])
async def get_coverage_analytics(target_date: date = None):
    """Get shift coverage analytics for a specific date from Snowflake."""
    if target_date is None:
        target_date = date.today()
    
    logger.info(f"Fetching coverage analytics for date: {target_date}")
    
    try:
        snowflake_service = get_snowflake_service()

        coverage = snowflake_service.get_shift_coverage_summary(target_date)
        
        logger.info(f"Retrieved {len(coverage)} coverage records from Snowflake for {target_date}")
        
        # Return results (empty list is valid - means no data for that date)
        return coverage
        
    except Exception as e:
        logger.error(f"Error fetching coverage analytics: {e}", exc_info=True)
        # Return empty list on error - frontend will show appropriate message
        return []


@router.post("/analytics/populate")
async def populate_analytics():
    """Manually trigger population of coverage analytics from unit assignments."""
    try:
        snowflake_service = get_snowflake_service()
        
        if not hasattr(snowflake_service, 'conn') or snowflake_service.conn is None:
            raise HTTPException(
                status_code=503,
                detail="Snowflake connection not available"
            )
        
        success = snowflake_service.populate_coverage_from_assignments()
        
        if success:
            return {
                "status": "success",
                "message": "Coverage analytics populated successfully"
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to populate coverage analytics"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error populating analytics: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error populating analytics: {str(e)}"
        )


@router.get("/analytics/health")
async def analytics_health():
    """Check if Snowflake analytics connection is working."""
    try:
        snowflake_service = get_snowflake_service()
        
        # Check if it's a mock service
        from app.services.snowflake_service import MockSnowflakeService
        if isinstance(snowflake_service, MockSnowflakeService):
            # Check if settings are actually configured
            from app.config import settings
            is_configured = (
                settings.snowflake_account != "placeholder" and
                settings.snowflake_user != "placeholder" and
                settings.snowflake_password != "placeholder"
            )
            
            if is_configured:
                return {
                    "status": "error",
                    "message": "Snowflake credentials configured but connection failed. Check logs for details.",
                    "configured": True,
                    "service_type": "mock_fallback"
                }
            else:
                return {
                    "status": "not_configured",
                    "message": "Snowflake not configured - using local fallback analytics and demo coverage when needed",
                    "configured": False,
                    "service_type": "mock"
                }
        
        # It's a real SnowflakeService - check connection
        if not hasattr(snowflake_service, 'conn') or snowflake_service.conn is None:
            return {
                "status": "disconnected",
                "message": "Snowflake service initialized but connection is None",
                "configured": True,
                "service_type": "real"
            }
        
        # Try a simple query to verify connection
        try:
            cursor = snowflake_service.conn.cursor()
            cursor.execute("SELECT CURRENT_TIMESTAMP(), CURRENT_DATABASE(), CURRENT_SCHEMA()")
            result = cursor.fetchone()
            cursor.close()
            
            return {
                "status": "connected",
                "message": "Snowflake connection is active",
                "configured": True,
                "service_type": "real",
                "server_time": str(result[0]) if result else None,
                "database": result[1] if result and len(result) > 1 else None,
                "schema": result[2] if result and len(result) > 2 else None
            }
        except Exception as conn_error:
            logger.error(f"Error executing test query: {conn_error}")
            return {
                "status": "error",
                "message": f"Connection exists but query failed: {str(conn_error)}",
                "configured": True,
                "service_type": "real"
            }
        
    except Exception as e:
        logger.error(f"Error checking Snowflake health: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
            "configured": False
        }
