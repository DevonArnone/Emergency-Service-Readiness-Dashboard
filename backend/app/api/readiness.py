"""API endpoints for emergency services readiness data models."""
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Query

from app.models import (
    AssignmentStatus,
    AvailabilityStatus,
    Personnel,
    Unit,
    UnitAssignment,
    Certification,
    RenewalTask,
    RenewalTaskStatus,
)
from app.stores import (
    personnel_store, units_store, unit_assignments_store, certifications_store,
    renewal_tasks_store,
)

router = APIRouter(prefix="/api", tags=["readiness"])

# Import services after stores to avoid circular imports
from app.services.readiness_service import ReadinessService
from app.services.certification_service import CertificationService
from app.services.snowflake_service import get_snowflake_service
from app.websocket.unit_readiness_manager import unit_readiness_manager
from app.services.audit_service import record_audit, unit_service_details


def _validate_assignment(assignment: UnitAssignment, ignore_id: str | None = None) -> tuple[Unit, Personnel]:
    if assignment.shift_end <= assignment.shift_start:
        raise HTTPException(status_code=400, detail="shift_end must be after shift_start")
    unit = units_store.get(assignment.unit_id)
    if not unit or unit.is_archived:
        raise HTTPException(status_code=404, detail="Unit not found")
    if unit.operational_status.value in {'OUT_OF_SERVICE', 'MAINTENANCE'}:
        raise HTTPException(status_code=409, detail='Unit is not available for assignment')
    personnel = personnel_store.get(assignment.personnel_id)
    if not personnel or personnel.is_archived:
        raise HTTPException(status_code=404, detail="Personnel not found")
    conflicts = [
        existing for existing in unit_assignments_store.values()
        if existing.assignment_id != ignore_id
        and existing.personnel_id == assignment.personnel_id
        and existing.assignment_status not in {AssignmentStatus.CANCELLED, AssignmentStatus.ABSENT}
        and existing.shift_start < assignment.shift_end
        and existing.shift_end > assignment.shift_start
    ]
    if conflicts:
        raise HTTPException(status_code=409, detail="Personnel has an overlapping assignment")
    missing_required = [
        cert for cert in unit.required_certifications if cert not in personnel.certifications
    ]
    if missing_required:
        raise HTTPException(
            status_code=400,
            detail=f"Personnel missing required certifications: {', '.join(missing_required)}",
        )
    now = datetime.now(timezone.utc)
    expired_required = [
        cert for cert in unit.required_certifications
        if not personnel.cert_expirations.get(cert)
        or personnel.cert_expirations[cert].replace(tzinfo=personnel.cert_expirations[cert].tzinfo or timezone.utc) < max(now, assignment.shift_end)
    ]
    if expired_required:
        raise HTTPException(
            status_code=400,
            detail=f"Required credentials must remain valid through shift end: {', '.join(expired_required)}",
        )
    return unit, personnel


# ---------------------------------------------------------------------------
# Personnel Endpoints
# ---------------------------------------------------------------------------
@router.post("/personnel", response_model=Personnel)
async def create_personnel(profile: Personnel) -> Personnel:
    """Persist the record and its durable change event without warehouse coupling."""
    personnel_id = str(uuid.uuid4())
    profile.personnel_id = personnel_id
    profile.last_check_in = profile.last_check_in or datetime.now(timezone.utc)
    personnel_store[personnel_id] = profile
    record_audit("CREATED", "personnel", personnel_id, f"Created {profile.name}")
    return profile


@router.get("/personnel", response_model=List[Personnel])
async def list_personnel(
    availability_status: AvailabilityStatus | None = Query(
        None, description="Filter by availability"
    )
) -> List[Personnel]:
    """List personnel, optionally filtered by availability."""
    people = [person for person in personnel_store.values() if not person.is_archived]
    if availability_status:
        people = [
            p for p in people if p.availability_status == availability_status
        ]
    return people


@router.get("/personnel/{personnel_id}", response_model=Personnel)
async def get_personnel(personnel_id: str) -> Personnel:
    """Retrieve a single personnel record."""
    person = personnel_store.get(personnel_id)
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")
    return person


@router.put("/personnel/{personnel_id}", response_model=Personnel)
async def update_personnel(personnel_id: str, profile: Personnel) -> Personnel:
    """Update an existing personnel profile."""
    if personnel_id not in personnel_store:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    profile.personnel_id = personnel_id
    profile.last_check_in = profile.last_check_in or personnel_store[personnel_id].last_check_in
    personnel_store[personnel_id] = profile
    
    # The relational adapter commits the corresponding durable outbox event.
    record_audit("UPDATED", "personnel", personnel_id, f"Updated {profile.name}")
    return profile


@router.delete("/personnel/{personnel_id}", response_model=Personnel)
async def archive_personnel(personnel_id: str) -> Personnel:
    person = personnel_store.get(personnel_id)
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")
    active_assignments = [
        assignment for assignment in unit_assignments_store.values()
        if assignment.personnel_id == personnel_id
        and assignment.assignment_status in {AssignmentStatus.ON_SHIFT, AssignmentStatus.PENDING}
    ]
    if active_assignments:
        raise HTTPException(status_code=409, detail="Cancel active assignments before archiving personnel")
    person.is_archived = True
    person.current_unit_id = None
    person.availability_status = AvailabilityStatus.OFF
    personnel_store[personnel_id] = person
    record_audit("ARCHIVED", "personnel", personnel_id, f"Archived {person.name}")
    return person


# ---------------------------------------------------------------------------
# Unit Endpoints
# ---------------------------------------------------------------------------
@router.post("/units", response_model=Unit)
async def create_unit(unit: Unit) -> Unit:
    """Create an emergency response unit."""
    unit_id = str(uuid.uuid4())
    unit.unit_id = unit_id
    units_store[unit_id] = unit
    
    # The relational adapter commits the corresponding durable outbox event.
    record_audit("CREATED", "unit", unit_id, f"Created {unit.unit_name}", details=unit_service_details(None, unit))
    return unit


@router.get("/units", response_model=List[Unit])
async def list_units(unit_type: str | None = Query(None, description="Filter by unit type")) -> List[Unit]:
    """List units, optionally filtered by type."""
    units = [unit for unit in units_store.values() if not unit.is_archived]
    if unit_type:
        units = [u for u in units if u.type == unit_type]
    return units


@router.get("/units/{unit_id}", response_model=Unit)
async def get_unit(unit_id: str) -> Unit:
    """Retrieve a unit definition."""
    unit = units_store.get(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit


@router.put("/units/{unit_id}", response_model=Unit)
async def update_unit(unit_id: str, unit: Unit) -> Unit:
    """Update an existing unit definition."""
    existing = units_store.get(unit_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Unit not found")

    unit.unit_id = unit_id
    units_store[unit_id] = unit

    # The relational adapter commits the corresponding durable outbox event.
    record_audit(
        "UPDATED", "unit", unit_id, f"Updated {unit.unit_name}",
        details=unit_service_details(existing, unit),
    )
    return unit


@router.delete("/units/{unit_id}", response_model=Unit)
async def archive_unit(unit_id: str) -> Unit:
    unit = units_store.get(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    active_assignments = [
        assignment for assignment in unit_assignments_store.values()
        if assignment.unit_id == unit_id
        and assignment.assignment_status in {AssignmentStatus.ON_SHIFT, AssignmentStatus.PENDING}
    ]
    if active_assignments:
        raise HTTPException(status_code=409, detail="Cancel active assignments before archiving unit")
    before = unit.model_copy()
    unit.is_archived = True
    unit.operational_status = "OUT_OF_SERVICE"
    units_store[unit_id] = unit
    record_audit("ARCHIVED", "unit", unit_id, f"Archived {unit.unit_name}", details=unit_service_details(before, unit))
    return unit


# ---------------------------------------------------------------------------
# Unit Assignment Endpoints
# ---------------------------------------------------------------------------
@router.post("/unit-assignments", response_model=UnitAssignment)
async def assign_personnel_to_unit(assignment: UnitAssignment) -> UnitAssignment:
    """Assign personnel to a unit for a given shift window."""
    unit, personnel = _validate_assignment(assignment)

    assignment_id = str(uuid.uuid4())
    assignment.assignment_id = assignment_id
    unit_assignments_store[assignment_id] = assignment

    # Update personnel status and linkage
    personnel.current_unit_id = unit.unit_id
    personnel.availability_status = AvailabilityStatus.DEPLOYED
    personnel_store[personnel.personnel_id] = personnel

    # The relational adapter commits the corresponding durable outbox event.

    # Broadcast readiness update via WebSocket
    asyncio.create_task(unit_readiness_manager.broadcast_unit_readiness(unit.unit_id))
    record_audit(
        "ASSIGNED",
        "assignment",
        assignment_id,
        f"Assigned {personnel.name} to {unit.unit_name}",
    )
    return assignment


@router.get("/unit-assignments", response_model=List[UnitAssignment])
async def list_unit_assignments(
    unit_id: str | None = Query(None, description="Filter by unit"),
    personnel_id: str | None = Query(None, description="Filter by personnel"),
) -> List[UnitAssignment]:
    """List unit assignments with optional filtering."""
    assignments = list(unit_assignments_store.values())
    if unit_id:
        assignments = [a for a in assignments if a.unit_id == unit_id]
    if personnel_id:
        assignments = [a for a in assignments if a.personnel_id == personnel_id]
    return sorted(assignments, key=lambda assignment: assignment.shift_start)


@router.put("/unit-assignments/{assignment_id}", response_model=UnitAssignment)
async def update_unit_assignment(assignment_id: str, assignment: UnitAssignment) -> UnitAssignment:
    if assignment_id not in unit_assignments_store:
        raise HTTPException(status_code=404, detail="Assignment not found")
    unit, personnel = _validate_assignment(assignment, assignment_id)
    assignment.assignment_id = assignment_id
    unit_assignments_store[assignment_id] = assignment
    personnel.current_unit_id = unit.unit_id if assignment.assignment_status == AssignmentStatus.ON_SHIFT else None
    personnel.availability_status = (
        AvailabilityStatus.DEPLOYED
        if assignment.assignment_status == AssignmentStatus.ON_SHIFT
        else AvailabilityStatus.AVAILABLE
    )
    personnel_store[personnel.personnel_id] = personnel
    record_audit("UPDATED", "assignment", assignment_id, f"Updated assignment for {personnel.name}")
    asyncio.create_task(unit_readiness_manager.broadcast_unit_readiness(unit.unit_id))
    return assignment


@router.delete("/unit-assignments/{assignment_id}", response_model=UnitAssignment)
async def cancel_unit_assignment(assignment_id: str) -> UnitAssignment:
    assignment = unit_assignments_store.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment.assignment_status = AssignmentStatus.CANCELLED
    assignment.clocked_out_at = assignment.clocked_out_at or datetime.now(timezone.utc)
    unit_assignments_store[assignment_id] = assignment
    person = personnel_store.get(assignment.personnel_id)
    if person and person.current_unit_id == assignment.unit_id:
        person.current_unit_id = None
        person.availability_status = AvailabilityStatus.AVAILABLE
        personnel_store[person.personnel_id] = person
    record_audit("CANCELLED", "assignment", assignment_id, "Cancelled roster assignment")
    asyncio.create_task(unit_readiness_manager.broadcast_unit_readiness(assignment.unit_id))
    return assignment


# ---------------------------------------------------------------------------
# Readiness & Status Endpoints
# ---------------------------------------------------------------------------
@router.get("/readiness/units")
async def get_all_units_readiness():
    """Get readiness status for all units."""
    return ReadinessService.check_all_units()


@router.get("/readiness/units/{unit_id}")
async def get_unit_readiness(unit_id: str):
    """Get current readiness status for a unit."""
    readiness = ReadinessService.get_unit_readiness(unit_id)
    if not readiness:
        raise HTTPException(status_code=404, detail="Unit not found")
    return readiness


@router.get("/readiness/units/{unit_id}/history")
async def get_unit_readiness_history(
    unit_id: str,
    days: int = Query(7, description="Number of days of history to retrieve")
):
    """Get readiness history for a unit from Snowflake analytics."""
    snowflake_service = get_snowflake_service()
    history = snowflake_service.get_unit_readiness_history(unit_id, days)
    return {
        "unit_id": unit_id,
        "days": days,
        "history": history
    }


# ---------------------------------------------------------------------------
# Certification Management Endpoints
# ---------------------------------------------------------------------------
@router.get("/certifications/expiring")
async def get_expiring_certifications(
    days_ahead: int = Query(30, description="Number of days to look ahead")
):
    """Get certifications expiring within specified days."""
    return CertificationService.check_expiring_certifications(days_ahead)


@router.get("/certifications/expired")
async def get_expired_certifications():
    """Get all expired certifications."""
    return CertificationService.check_expired_certifications()


@router.post("/certifications/check-expirations")
async def check_and_mark_expired():
    """
    Check for expired certifications and mark personnel as unqualified.
    This would typically run as a daily cron job.
    """
    marked_count = CertificationService.mark_personnel_unqualified()
    
    # Broadcast readiness updates for affected units
    affected_units = set()
    for assignment in unit_assignments_store.values():
        if assignment.assignment_status == AssignmentStatus.ON_SHIFT:
            affected_units.add(assignment.unit_id)
    
    # Trigger readiness broadcasts
    for unit_id in affected_units:
        asyncio.create_task(unit_readiness_manager.broadcast_unit_readiness(unit_id))
    
    return {
        "marked_unqualified": marked_count,
        "affected_units": list(affected_units),
        "message": f"Marked {marked_count} personnel as unqualified due to expired certifications"
    }


# ---------------------------------------------------------------------------
# Certification Management Endpoints
# ---------------------------------------------------------------------------
@router.post("/certifications", response_model=Certification)
async def create_certification(certification: Certification) -> Certification:
    """Create a new certification definition."""
    certification_id = str(uuid.uuid4())
    certification.certification_id = certification_id
    certifications_store[certification_id] = certification
    record_audit("CREATED", "certification", certification_id, f"Created {certification.name}")
    return certification


@router.get("/certifications", response_model=List[Certification])
async def list_certifications(
    category: str | None = Query(None, description="Filter by category")
) -> List[Certification]:
    """List all certification definitions."""
    certs = list(certifications_store.values())
    if category:
        certs = [c for c in certs if c.category == category]
    return certs


@router.get("/certifications/{certification_id}", response_model=Certification)
async def get_certification(certification_id: str) -> Certification:
    """Retrieve a certification definition."""
    cert = certifications_store.get(certification_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certification not found")
    return cert


@router.put("/certifications/{certification_id}", response_model=Certification)
async def update_certification(certification_id: str, certification: Certification) -> Certification:
    """Update an existing certification definition."""
    if certification_id not in certifications_store:
        raise HTTPException(status_code=404, detail="Certification not found")
    
    certification.certification_id = certification_id
    certifications_store[certification_id] = certification
    record_audit("UPDATED", "certification", certification_id, f"Updated {certification.name}")
    return certification


@router.get("/certifications/{certification_id}/impact")
async def certification_impact(certification_id: str):
    cert = certifications_store.get(certification_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certification not found")
    personnel = [person for person in personnel_store.values() if cert.name in person.certifications]
    units = [unit for unit in units_store.values() if cert.name in unit.required_certifications]
    return {
        "certification_id": certification_id,
        "personnel_count": len(personnel),
        "unit_count": len(units),
        "personnel": [{"personnel_id": person.personnel_id, "name": person.name} for person in personnel],
        "units": [{"unit_id": unit.unit_id, "unit_name": unit.unit_name} for unit in units],
    }


@router.delete("/certifications/{certification_id}")
async def delete_certification(certification_id: str, force: bool = Query(False)):
    """Delete a certification definition."""
    if certification_id not in certifications_store:
        raise HTTPException(status_code=404, detail="Certification not found")
    
    impact = await certification_impact(certification_id)
    if not force and (impact["personnel_count"] or impact["unit_count"]):
        raise HTTPException(status_code=409, detail="Certification is still assigned; review impact before deletion")
    cert = certifications_store[certification_id]
    del certifications_store[certification_id]
    record_audit("DELETED", "certification", certification_id, f"Deleted {cert.name}", details=impact)
    return {"message": "Certification deleted successfully"}


# ---------------------------------------------------------------------------
# Renewal Task Endpoints
# ---------------------------------------------------------------------------
@router.get("/renewal-tasks", response_model=List[RenewalTask])
async def list_renewal_tasks(
    status: RenewalTaskStatus | None = Query(None),
    personnel_id: str | None = Query(None),
) -> List[RenewalTask]:
    tasks = list(renewal_tasks_store.values())
    if status:
        tasks = [task for task in tasks if task.status == status]
    if personnel_id:
        tasks = [task for task in tasks if task.personnel_id == personnel_id]
    return sorted(tasks, key=lambda task: task.due_date)


@router.post("/renewal-tasks", response_model=RenewalTask)
async def create_renewal_task(task: RenewalTask) -> RenewalTask:
    if task.personnel_id not in personnel_store:
        raise HTTPException(status_code=404, detail="Personnel not found")
    task.renewal_id = f"renewal-{uuid.uuid4().hex[:12]}"
    task.created_at = datetime.now(timezone.utc)
    renewal_tasks_store[task.renewal_id] = task
    record_audit("CREATED", "renewal", task.renewal_id, f"Created renewal task for {task.certification}")
    return task


@router.put("/renewal-tasks/{renewal_id}", response_model=RenewalTask)
async def update_renewal_task(renewal_id: str, task: RenewalTask) -> RenewalTask:
    existing = renewal_tasks_store.get(renewal_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Renewal task not found")
    task.renewal_id = renewal_id
    task.created_at = task.created_at or existing.created_at
    if task.status == RenewalTaskStatus.COMPLETED:
        task.completed_at = task.completed_at or datetime.now(timezone.utc)
    renewal_tasks_store[renewal_id] = task
    record_audit("UPDATED", "renewal", renewal_id, f"Updated renewal task for {task.certification}")
    return task
