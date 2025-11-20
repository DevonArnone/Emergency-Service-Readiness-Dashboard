"""API endpoints for emergency services readiness data models."""
import uuid
import asyncio
from datetime import datetime
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Query

from app.models import (
    AssignmentStatus,
    AvailabilityStatus,
    Personnel,
    Unit,
    UnitAssignment,
    Certification,
)
from app.stores import (
    personnel_store, units_store, unit_assignments_store, certifications_store
)

router = APIRouter(prefix="/api", tags=["readiness"])

# Import services after stores to avoid circular imports
from app.services.readiness_service import ReadinessService
from app.services.certification_service import CertificationService
from app.services.snowflake_service import get_snowflake_service
from app.websocket.unit_readiness_manager import unit_readiness_manager


# ---------------------------------------------------------------------------
# Personnel Endpoints
# ---------------------------------------------------------------------------
@router.post("/personnel", response_model=Personnel)
async def create_personnel(profile: Personnel) -> Personnel:
    """Create a new personnel profile."""
    try:
        personnel_id = str(uuid.uuid4())
        profile.personnel_id = personnel_id
        profile.last_check_in = profile.last_check_in or datetime.utcnow()
        
        # Ensure cert_expirations are datetime objects (validator should handle this, but double-check)
        if profile.cert_expirations:
            normalized_expirations = {}
            for cert_name, exp_date in profile.cert_expirations.items():
                if isinstance(exp_date, str):
                    try:
                        if exp_date.endswith('Z'):
                            exp_date = exp_date.replace('Z', '+00:00')
                        if 'T' in exp_date:
                            normalized_expirations[cert_name] = datetime.fromisoformat(exp_date)
                        else:
                            normalized_expirations[cert_name] = datetime.fromisoformat(exp_date + 'T23:59:59+00:00')
                    except (ValueError, AttributeError):
                        # Keep as string if parsing fails
                        normalized_expirations[cert_name] = exp_date
                else:
                    normalized_expirations[cert_name] = exp_date
            profile.cert_expirations = normalized_expirations
        
        personnel_store[personnel_id] = profile
        
        # Insert into Snowflake (non-blocking)
        snowflake_service = get_snowflake_service()
        snowflake_service.insert_personnel(profile)
        
        return profile
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating personnel: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Failed to create personnel: {str(e)}")


@router.get("/personnel", response_model=List[Personnel])
async def list_personnel(
    availability_status: AvailabilityStatus | None = Query(
        None, description="Filter by availability"
    )
) -> List[Personnel]:
    """List personnel, optionally filtered by availability."""
    people = list(personnel_store.values())
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
    
    # Update in Snowflake (non-blocking)
    snowflake_service = get_snowflake_service()
    snowflake_service.insert_personnel(profile)
    
    return profile


# ---------------------------------------------------------------------------
# Unit Endpoints
# ---------------------------------------------------------------------------
@router.post("/units", response_model=Unit)
async def create_unit(unit: Unit) -> Unit:
    """Create an emergency response unit."""
    unit_id = str(uuid.uuid4())
    unit.unit_id = unit_id
    units_store[unit_id] = unit
    
    # Insert into Snowflake (non-blocking)
    snowflake_service = get_snowflake_service()
    snowflake_service.insert_unit(unit)
    
    return unit


@router.get("/units", response_model=List[Unit])
async def list_units(unit_type: str | None = Query(None, description="Filter by unit type")) -> List[Unit]:
    """List units, optionally filtered by type."""
    units = list(units_store.values())
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
    if unit_id not in units_store:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    unit.unit_id = unit_id
    units_store[unit_id] = unit
    
    # Update in Snowflake (non-blocking)
    snowflake_service = get_snowflake_service()
    snowflake_service.insert_unit(unit)
    
    return unit


# ---------------------------------------------------------------------------
# Unit Assignment Endpoints
# ---------------------------------------------------------------------------
@router.post("/unit-assignments", response_model=UnitAssignment)
async def assign_personnel_to_unit(assignment: UnitAssignment) -> UnitAssignment:
    """Assign personnel to a unit for a given shift window."""
    if assignment.shift_end <= assignment.shift_start:
        raise HTTPException(status_code=400, detail="shift_end must be after shift_start")

    unit = units_store.get(assignment.unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    personnel = personnel_store.get(assignment.personnel_id)
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")

    # Validate certifications
    missing_required = [
        cert for cert in unit.required_certifications if cert not in personnel.certifications
    ]
    if missing_required:
        raise HTTPException(
            status_code=400,
            detail=f"Personnel missing required certifications: {', '.join(missing_required)}",
        )

    assignment_id = str(uuid.uuid4())
    assignment.assignment_id = assignment_id
    unit_assignments_store[assignment_id] = assignment

    # Update personnel status and linkage
    personnel.current_unit_id = unit.unit_id
    personnel.availability_status = AvailabilityStatus.DEPLOYED
    personnel_store[personnel.personnel_id] = personnel

    # Insert into Snowflake (non-blocking)
    snowflake_service = get_snowflake_service()
    snowflake_service.insert_unit_assignment(assignment)
    snowflake_service.insert_personnel(personnel)  # Update personnel record

    # Broadcast readiness update via WebSocket
    asyncio.create_task(unit_readiness_manager.broadcast_unit_readiness(unit.unit_id))

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
    return assignments


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
    return certification


@router.delete("/certifications/{certification_id}")
async def delete_certification(certification_id: str):
    """Delete a certification definition."""
    if certification_id not in certifications_store:
        raise HTTPException(status_code=404, detail="Certification not found")
    
    del certifications_store[certification_id]
    return {"message": "Certification deleted successfully"}

