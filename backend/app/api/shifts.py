"""REST API endpoints for shifts and employees."""
import logging
import uuid
from datetime import datetime, date
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import sqlalchemy as sa

from app.models import (
    Employee, Shift, ShiftAssignment, ShiftEvent, 
    ClockInRequest, ClockOutRequest, LiveShiftStatus, CoverageSummary
)
from app.config import settings
from app.websocket.manager import websocket_manager
from app.services.kafka_service import get_kafka_service
from app.services.snowflake_service import get_snowflake_service
from app.models import EventType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["shifts"])

# Database setup (SQLite for development)
engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# In-memory stores for MVP (will be replaced with proper DB tables)
employees_store: dict[str, Employee] = {}
shifts_store: dict[str, Shift] = {}
assignments_store: dict[str, ShiftAssignment] = {}
clock_ins: dict[str, set[str]] = {}  # shift_id -> set of employee_ids


async def get_db():
    """Dependency for database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def _emit_shift_event(
    shift_id: str,
    event_type: EventType,
    employee_id: str = None,
    payload: dict = None
):
    """Helper to emit shift events to Kafka, Snowflake, and WebSocket."""
    event = ShiftEvent(
        event_id=str(uuid.uuid4()),
        shift_id=shift_id,
        employee_id=employee_id,
        event_type=event_type,
        event_time=datetime.utcnow(),
        payload=payload or {},
    )
    
    # 1. Produce to Kafka (non-blocking)
    kafka_service = get_kafka_service()
    kafka_service.produce_shift_event(event)
    
    # 2. Insert to Snowflake (non-blocking)
    snowflake_service = get_snowflake_service()
    snowflake_service.insert_shift_event(event)
    
    # 3. Broadcast via WebSocket (async)
    try:
        await websocket_manager.broadcast_event(event)
    except Exception as e:
        logger.error(f"Error broadcasting WebSocket event: {e}")


@router.post("/employees", response_model=Employee)
async def create_employee(employee: Employee):
    """Create a new employee."""
    employee_id = str(uuid.uuid4())
    employee.employee_id = employee_id
    employee.hire_date = employee.hire_date or datetime.utcnow()
    employees_store[employee_id] = employee
    
    logger.info(f"Created employee: {employee_id} - {employee.name}")
    return employee


@router.get("/employees", response_model=List[Employee])
async def list_employees():
    """List all employees."""
    return list(employees_store.values())


@router.post("/shifts", response_model=Shift)
async def create_shift(shift: Shift):
    """Create a new shift."""
    shift_id = str(uuid.uuid4())
    shift.shift_id = shift_id
    shift.created_at = datetime.utcnow()
    shifts_store[shift_id] = shift
    clock_ins[shift_id] = set()
    
    # Emit CREATED event
    await _emit_shift_event(shift_id, EventType.CREATED)
    
    logger.info(f"Created shift: {shift_id} at {shift.location}")
    return shift


@router.get("/shifts", response_model=List[Shift])
async def list_shifts():
    """List all shifts."""
    return list(shifts_store.values())


@router.post("/shifts/{shift_id}/assign", response_model=ShiftAssignment)
async def assign_employee_to_shift(shift_id: str, employee_id: str):
    """Assign an employee to a shift."""
    if shift_id not in shifts_store:
        raise HTTPException(status_code=404, detail="Shift not found")
    if employee_id not in employees_store:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    assignment_id = str(uuid.uuid4())
    assignment = ShiftAssignment(
        assignment_id=assignment_id,
        shift_id=shift_id,
        employee_id=employee_id,
        assigned_at=datetime.utcnow(),
    )
    assignments_store[assignment_id] = assignment
    
    # Emit ASSIGNED event
    await _emit_shift_event(shift_id, EventType.ASSIGNED, employee_id)
    
    logger.info(f"Assigned employee {employee_id} to shift {shift_id}")
    return assignment


@router.post("/shifts/{shift_id}/clock-in")
async def clock_in(shift_id: str, request: ClockInRequest):
    """Clock in an employee for a shift."""
    if shift_id not in shifts_store:
        raise HTTPException(status_code=404, detail="Shift not found")
    if request.employee_id not in employees_store:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Add to clock-ins
    if shift_id not in clock_ins:
        clock_ins[shift_id] = set()
    clock_ins[shift_id].add(request.employee_id)
    
    # Emit CLOCK_IN event
    await _emit_shift_event(shift_id, EventType.CLOCK_IN, request.employee_id)
    
    # Check for understaffing
    shift = shifts_store[shift_id]
    current_count = len(clock_ins[shift_id])
    if current_count < shift.required_headcount:
        await _emit_shift_event(
            shift_id,
            EventType.ALERT_UNDERSTAFFED,
            payload={"current_count": current_count, "required": shift.required_headcount}
        )
    
    logger.info(f"Employee {request.employee_id} clocked in to shift {shift_id}")
    return {"status": "clocked_in", "shift_id": shift_id, "employee_id": request.employee_id}


@router.post("/shifts/{shift_id}/clock-out")
async def clock_out(shift_id: str, request: ClockOutRequest):
    """Clock out an employee from a shift."""
    if shift_id not in shifts_store:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    # Remove from clock-ins
    if shift_id in clock_ins:
        clock_ins[shift_id].discard(request.employee_id)
    
    # Emit CLOCK_OUT event
    await _emit_shift_event(shift_id, EventType.CLOCK_OUT, request.employee_id)
    
    logger.info(f"Employee {request.employee_id} clocked out from shift {shift_id}")
    return {"status": "clocked_out", "shift_id": shift_id, "employee_id": request.employee_id}


@router.get("/shifts/live", response_model=List[LiveShiftStatus])
async def get_live_shifts():
    """Get current live status of all shifts."""
    today = date.today()
    live_statuses = []
    
    for shift_id, shift in shifts_store.items():
        # Only show shifts for today
        if shift.start_time.date() != today:
            continue
        
        assigned_count = len([a for a in assignments_store.values() if a.shift_id == shift_id])
        clocked_in_count = len(clock_ins.get(shift_id, set()))
        
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
        )
        live_statuses.append(live_status)
    
    return live_statuses


@router.get("/analytics/coverage", response_model=List[CoverageSummary])
async def get_coverage_analytics(target_date: date = None):
    """Get shift coverage analytics for a specific date."""
    if target_date is None:
        target_date = date.today()
    
    snowflake_service = get_snowflake_service()
    coverage = snowflake_service.get_shift_coverage_summary(target_date)
    
    # If Snowflake returns empty, return mock data for development
    if not coverage:
        logger.info("No Snowflake data available, returning empty list")
        return []
    
    return coverage

