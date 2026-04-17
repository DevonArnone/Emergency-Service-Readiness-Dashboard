"""Pydantic models for the Emergency Readiness platform."""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List, Dict, Union
from enum import Enum


class EventType(str, Enum):
    CREATED = "CREATED"
    ASSIGNED = "ASSIGNED"
    CLOCK_IN = "CLOCK_IN"
    CLOCK_OUT = "CLOCK_OUT"
    ALERT_UNDERSTAFFED = "ALERT_UNDERSTAFFED"
    ALERT_OVERTIME_RISK = "ALERT_OVERTIME_RISK"


class Employee(BaseModel):
    employee_id: Optional[str] = None
    name: str
    role: str
    location: str
    hire_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class Shift(BaseModel):
    shift_id: Optional[str] = None
    location: str
    start_time: datetime
    end_time: datetime
    required_headcount: int = Field(gt=0)
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ShiftAssignment(BaseModel):
    assignment_id: Optional[str] = None
    shift_id: str
    employee_id: str
    assigned_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ShiftEvent(BaseModel):
    event_id: Optional[str] = None
    shift_id: str
    employee_id: Optional[str] = None
    event_type: EventType
    event_time: datetime
    payload: Optional[Dict] = None

    class Config:
        from_attributes = True


class ClockInRequest(BaseModel):
    employee_id: str


class ClockOutRequest(BaseModel):
    employee_id: str


class LiveShiftStatus(BaseModel):
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
    location: str
    hour: int
    scheduled_headcount: int
    actual_headcount: int
    understaffed_flag: bool
    overtime_risk_flag: bool
    date: datetime


# ── Emergency Services core models ──────────────────────────────────────────

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
    cert_expirations: Dict[str, Union[datetime, str]] = Field(default_factory=dict)
    availability_status: AvailabilityStatus = AvailabilityStatus.AVAILABLE
    last_check_in: Optional[datetime] = None
    station_id: Optional[str] = None
    current_unit_id: Optional[str] = None
    notes: Optional[str] = None

    @field_validator('cert_expirations', mode='before')
    @classmethod
    def parse_cert_expirations(cls, v):
        if not isinstance(v, dict):
            return v
        result = {}
        for cert_name, exp_date in v.items():
            if isinstance(exp_date, str):
                try:
                    if exp_date.endswith('Z'):
                        exp_date = exp_date.replace('Z', '+00:00')
                    if 'T' in exp_date:
                        result[cert_name] = datetime.fromisoformat(exp_date)
                    else:
                        result[cert_name] = datetime.fromisoformat(exp_date + 'T23:59:59+00:00')
                except (ValueError, AttributeError, TypeError) as e:
                    import logging
                    logging.getLogger(__name__).warning(
                        f"Failed to parse expiration date '{exp_date}' for cert '{cert_name}': {e}"
                    )
                    result[cert_name] = exp_date
            elif isinstance(exp_date, datetime):
                result[cert_name] = exp_date
            else:
                result[cert_name] = exp_date
        return result

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
    certification_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    typical_validity_days: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Station ──────────────────────────────────────────────────────────────────

class Station(BaseModel):
    station_id: Optional[str] = None
    name: str
    district: Optional[str] = None
    address: Optional[str] = None
    unit_ids: List[str] = Field(default_factory=list)
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        from_attributes = True


# ── Alerts ───────────────────────────────────────────────────────────────────

class AlertType(str, Enum):
    UNDERSTAFFED_UNIT = "UNDERSTAFFED_UNIT"
    EXPIRED_CERTIFICATION = "EXPIRED_CERTIFICATION"
    EXPIRING_CERTIFICATION = "EXPIRING_CERTIFICATION"
    OVERTIME_RISK = "OVERTIME_RISK"
    UNIT_OFFLINE = "UNIT_OFFLINE"


class AlertState(str, Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class ReadinessAlert(BaseModel):
    alert_id: Optional[str] = None
    alert_type: AlertType
    state: AlertState = AlertState.OPEN
    unit_id: Optional[str] = None
    station_id: Optional[str] = None
    personnel_id: Optional[str] = None
    message: str
    details: Optional[Dict] = None
    created_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    acknowledged_note: Optional[str] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AcknowledgeAlertRequest(BaseModel):
    acknowledged_by: str
    note: Optional[str] = None


# ── Incidents ─────────────────────────────────────────────────────────────────

class IncidentPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class OperationalIncident(BaseModel):
    incident_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: IncidentPriority = IncidentPriority.MEDIUM
    station_id: Optional[str] = None
    unit_id: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Recommendations ───────────────────────────────────────────────────────────

class ReadinessRecommendation(BaseModel):
    recommendation_id: Optional[str] = None
    unit_id: str
    action_type: str  # REASSIGN | ESCALATE | RENEW_CERT
    message: str
    details: Optional[Dict] = None
    priority: str = "MEDIUM"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Dashboard summary ─────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    total_units: int
    ready_units: int
    degraded_units: int
    critical_units: int
    open_alerts: int
    active_incidents: int
    overall_readiness_pct: float
    station_summaries: List[Dict] = Field(default_factory=list)
    timestamp: str


# ── Simulation ────────────────────────────────────────────────────────────────

class SimulationRequest(BaseModel):
    unit_id: Optional[str] = None
    station_id: Optional[str] = None
    scenario: str  # "callout" | "unit_offline"
    personnel_to_remove: List[str] = Field(default_factory=list)


class SimulationResult(BaseModel):
    scenario: str
    original_readiness: List[Dict]
    degraded_readiness: List[Dict]
    impacted_units: List[str]
    recovery_actions: List[str]
    timestamp: str
