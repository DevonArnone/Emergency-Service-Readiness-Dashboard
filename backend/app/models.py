"""Pydantic models for the Emergency Readiness platform."""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List, Dict, Union, Any, Literal
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
    station_id: Optional[str] = None
    unit_id: Optional[str] = None
    status: str = "SCHEDULED"
    notes: Optional[str] = None
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
    station_id: Optional[str] = None
    unit_id: Optional[str] = None
    assigned_personnel: List[Dict] = Field(default_factory=list)


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
    TRUCK = "TRUCK"
    RESCUE = "RESCUE"
    MEDIC = "MEDIC"
    AMBULANCE = "AMBULANCE"
    TANKER = "TANKER"
    COMMAND = "COMMAND"
    SAFETY = "SAFETY"
    HAZMAT = "HAZMAT"
    SAR_TEAM = "SAR_TEAM"


class AssignmentStatus(str, Enum):
    ON_SHIFT = "ON_SHIFT"
    PENDING = "PENDING"
    ABSENT = "ABSENT"
    EARLY_OFF = "EARLY_OFF"
    CANCELLED = "CANCELLED"


class UnitOperationalStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    DEPLOYED = "DEPLOYED"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"
    MAINTENANCE = "MAINTENANCE"


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
    is_archived: bool = False

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
    operational_status: UnitOperationalStatus = UnitOperationalStatus.AVAILABLE
    is_archived: bool = False

    class Config:
        from_attributes = True


class UnitAssignment(BaseModel):
    assignment_id: Optional[str] = None
    unit_id: str
    personnel_id: str
    shift_start: datetime
    shift_end: datetime
    assignment_status: AssignmentStatus = AssignmentStatus.ON_SHIFT
    shift_id: Optional[str] = None
    clocked_in_at: Optional[datetime] = None
    clocked_out_at: Optional[datetime] = None
    notes: Optional[str] = None

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


class IncidentType(str, Enum):
    FIRE = "FIRE"
    EMS = "EMS"
    HAZMAT = "HAZMAT"
    OTHER = "OTHER"


class IncidentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ENROUTE = "ENROUTE"
    ON_SCENE = "ON_SCENE"
    TRANSPORT = "TRANSPORT"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"


class OperationalIncident(BaseModel):
    incident_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: IncidentPriority = IncidentPriority.MEDIUM
    incident_type: IncidentType = IncidentType.OTHER
    display_location: Optional[str] = None
    status: IncidentStatus = IncidentStatus.ACTIVE
    station_id: Optional[str] = None
    unit_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: str = "SYNTHETIC_DEMO"
    source_reference: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    assigned_unit_ids: List[str] = Field(default_factory=list)
    commander: Optional[str] = None

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


class CommandBoardPersonnel(BaseModel):
    authorized: int
    on_duty: int
    available: int
    deployed: int
    off: int
    in_training: int
    on_call: int


class CommandBoardStationNetwork(BaseModel):
    total: int
    online: int
    staffing_attention: int
    offline: int


class CommandBoardApparatusGroup(BaseModel):
    key: str
    label: str
    total: int
    in_service: int
    out_of_service: int
    availability_pct: float


class CommandBoardDutyBrief(BaseModel):
    active_incidents: int
    open_alerts: int
    staffing_attention_stations: int
    critical_units: int
    high_priority_incidents: List[str] = Field(default_factory=list)
    alert_messages: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


class CommandBoard(BaseModel):
    personnel: CommandBoardPersonnel
    incident_types: Dict[str, int]
    station_network: CommandBoardStationNetwork
    apparatus: List[CommandBoardApparatusGroup]
    duty_brief: CommandBoardDutyBrief


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


class RenewalTaskStatus(str, Enum):
    OPEN = "OPEN"
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class RenewalTask(BaseModel):
    renewal_id: Optional[str] = None
    personnel_id: str
    certification: str
    due_date: datetime
    status: RenewalTaskStatus = RenewalTaskStatus.OPEN
    owner: Optional[str] = None
    scheduled_for: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AuditEvent(BaseModel):
    audit_id: Optional[str] = None
    action: str
    entity_type: str
    entity_id: str
    actor: str = "Duty Officer"
    summary: str
    details: Dict = Field(default_factory=dict)
    previous_hash: Optional[str] = None
    event_hash: Optional[str] = None
    created_at: Optional[datetime] = None


class OperationsSnapshot(BaseModel):
    summary: DashboardSummary
    command_board: CommandBoard
    units: List[Dict[str, Any]] = Field(default_factory=list)
    alerts: List[ReadinessAlert] = Field(default_factory=list)
    incidents: List[OperationalIncident] = Field(default_factory=list)
    recommendations: List[ReadinessRecommendation] = Field(default_factory=list)
    renewals: List[RenewalTask] = Field(default_factory=list)
    activity: List[AuditEvent] = Field(default_factory=list)
    timestamp: str


class WeatherForecastPeriod(BaseModel):
    number: Optional[int] = None
    name: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_daytime: Optional[bool] = None
    temperature: Optional[float] = None
    temperature_unit: Optional[str] = None
    probability_of_precipitation: Optional[float] = None
    wind_speed: Optional[str] = None
    wind_direction: Optional[str] = None
    short_forecast: Optional[str] = None
    detailed_forecast: Optional[str] = None


class WeatherAlert(BaseModel):
    id: Optional[str] = None
    event: Optional[str] = None
    severity: Optional[str] = None
    urgency: Optional[str] = None
    certainty: Optional[str] = None
    headline: Optional[str] = None
    description: Optional[str] = None
    instruction: Optional[str] = None
    onset: Optional[str] = None
    ends: Optional[str] = None
    sender_name: Optional[str] = None


class WeatherSource(BaseModel):
    name: str
    url: str
    retrieved_at: Optional[str] = None
    source_updated_at: Optional[str] = None


class FairfaxWeatherResponse(BaseModel):
    status: Literal["live", "stale", "unavailable"]
    available: bool
    stale: bool
    message: Optional[str] = None
    location: str
    forecast_periods: List[WeatherForecastPeriod] = Field(default_factory=list)
    active_alerts: List[WeatherAlert] = Field(default_factory=list)
    wind: Dict[str, Optional[str]] = Field(default_factory=dict)
    source: WeatherSource


class ApiError(BaseModel):
    code: str
    message: str
    field_errors: Dict[str, str] = Field(default_factory=dict)
    request_id: str


class EventPriority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    BULK = "BULK"


class EventEnvelope(BaseModel):
    """Versioned contract shared by ingestion, Kafka, Redis, and WebSockets."""

    event_id: str = Field(min_length=1, max_length=128)
    organization_id: str = Field(min_length=1, max_length=64, pattern=r'^[A-Za-z0-9_-]+$')
    source: str = Field(min_length=1, max_length=120)
    event_type: str = Field(min_length=1, max_length=160)
    priority: EventPriority = EventPriority.NORMAL
    topic_class: Literal["alert", "bulk", "audit"] = "bulk"
    occurred_at: datetime
    schema_version: Literal[1] = 1
    aggregate_type: str = Field(min_length=1, max_length=80)
    aggregate_id: str = Field(min_length=1, max_length=128)
    payload: Dict[str, Any] = Field(default_factory=dict)


class IngestEventRequest(BaseModel):
    event_id: Optional[str] = Field(default=None, min_length=1, max_length=128)
    organization_id: Optional[str] = Field(default=None, min_length=1, max_length=64, pattern=r'^[A-Za-z0-9_-]+$')
    source: str = Field(min_length=1, max_length=120)
    event_type: str = Field(min_length=1, max_length=160)
    priority: EventPriority = EventPriority.NORMAL
    topic_class: Literal["alert", "bulk", "audit"] = "bulk"
    occurred_at: Optional[datetime] = None
    schema_version: Literal[1] = 1
    aggregate_type: str = Field(min_length=1, max_length=80)
    aggregate_id: str = Field(min_length=1, max_length=128)
    payload: Dict[str, Any] = Field(default_factory=dict)
