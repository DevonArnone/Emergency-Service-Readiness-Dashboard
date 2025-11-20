"""Pydantic models for the Workforce & Shift Management system."""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum


class EventType(str, Enum):
    """Types of shift events."""
    CREATED = "CREATED"
    ASSIGNED = "ASSIGNED"
    CLOCK_IN = "CLOCK_IN"
    CLOCK_OUT = "CLOCK_OUT"
    ALERT_UNDERSTAFFED = "ALERT_UNDERSTAFFED"
    ALERT_OVERTIME_RISK = "ALERT_OVERTIME_RISK"


class Employee(BaseModel):
    """Employee model."""
    employee_id: Optional[str] = None
    name: str
    role: str
    location: str
    hire_date: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class Shift(BaseModel):
    """Shift model."""
    shift_id: Optional[str] = None
    location: str
    start_time: datetime
    end_time: datetime
    required_headcount: int = Field(gt=0, description="Minimum number of employees needed")
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ShiftAssignment(BaseModel):
    """Shift assignment model."""
    assignment_id: Optional[str] = None
    shift_id: str
    employee_id: str
    assigned_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ShiftEvent(BaseModel):
    """Shift event model for event streaming."""
    event_id: Optional[str] = None
    shift_id: str
    employee_id: Optional[str] = None
    event_type: EventType
    event_time: datetime
    payload: Optional[Dict] = None
    
    class Config:
        from_attributes = True


class ClockInRequest(BaseModel):
    """Clock-in request model."""
    employee_id: str


class ClockOutRequest(BaseModel):
    """Clock-out request model."""
    employee_id: str


class LiveShiftStatus(BaseModel):
    """Live shift status model."""
    shift_id: str
    location: str
    start_time: datetime
    end_time: datetime
    required_headcount: int
    assigned_count: int
    clocked_in_count: int
    status: str
    alerts: List[str] = Field(default_factory=list)


class CoverageSummary(BaseModel):
    """Coverage summary model for analytics."""
    location: str
    hour: int
    scheduled_headcount: int
    actual_headcount: int
    understaffed_flag: bool
    overtime_risk_flag: bool
    date: datetime


# Emergency Services Models
class AvailabilityStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    OFF = "OFF"
    IN_TRAINING = "IN_TRAINING"
    DEPLOYED = "DEPLOYED"
    ON_CALL = "ON_CALL"


class UnitType(str, Enum):
    ENGINE = "ENGINE"
    LADDER = "LADDER"
    RESCUE = "RESCUE"
    MEDIC = "MEDIC"
    SAR_TEAM = "SAR_TEAM"


class AssignmentStatus(str, Enum):
    ON_SHIFT = "ON_SHIFT"
    PENDING = "PENDING"
    ABSENT = "ABSENT"
    EARLY_OFF = "EARLY_OFF"


class Personnel(BaseModel):
    personnel_id: Optional[str] = None
    name: str
    rank: Optional[str] = None
    role: str
    certifications: List[str] = Field(default_factory=list)
    cert_expirations: Dict[str, datetime] = Field(default_factory=dict)
    availability_status: AvailabilityStatus = AvailabilityStatus.AVAILABLE
    last_check_in: Optional[datetime] = None
    station_id: Optional[str] = None
    current_unit_id: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class Unit(BaseModel):
    unit_id: Optional[str] = None
    unit_name: str
    type: UnitType
    minimum_staff: int = Field(gt=0)
    required_certifications: List[str] = Field(default_factory=list)
    station_id: Optional[str] = None

    class Config:
        from_attributes = True


class UnitAssignment(BaseModel):
    assignment_id: Optional[str] = None
    unit_id: str
    personnel_id: str
    shift_start: datetime
    shift_end: datetime
    assignment_status: AssignmentStatus = AssignmentStatus.ON_SHIFT

    class Config:
        from_attributes = True


class UnitReadinessStatus(BaseModel):
    """Unit readiness status model."""
    unit_id: str
    unit_name: str
    unit_type: str
    readiness_score: int
    staff_required: int
    staff_present: int
    certifications_missing: List[str] = Field(default_factory=list)
    expired_certifications: List[str] = Field(default_factory=list)
    is_understaffed: bool
    issues: List[str] = Field(default_factory=list)
    assigned_personnel: List[Dict] = Field(default_factory=list)
    timestamp: str


class Certification(BaseModel):
    """Certification definition model."""
    certification_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    category: Optional[str] = None  # e.g., "Fire", "EMS", "Rescue"
    typical_validity_days: Optional[int] = None  # Typical validity period in days
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
