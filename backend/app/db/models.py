"""Normalized relational schema for operational Aegis Command data."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSON_DOCUMENT


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    organization_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    is_public_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("organization_id", "subject_id", name="membership_subject"),
        Index("ix_memberships_org_role", "organization_id", "role"),
    )

    membership_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False
    )
    subject_id: Mapped[str] = mapped_column(String(180), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320))
    display_name: Mapped[str | None] = mapped_column(String(180))
    role: Mapped[str] = mapped_column(String(40), nullable=False)
    battalion_ids: Mapped[list[str]] = mapped_column(JSON_DOCUMENT, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class Battalion(Base):
    __tablename__ = "battalions"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="battalion_code"),
    )

    battalion_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    division: Mapped[str | None] = mapped_column(String(80))
    boundary: Mapped[dict[str, Any] | None] = mapped_column(JSON_DOCUMENT)


class Station(Base):
    __tablename__ = "stations"
    __table_args__ = (
        UniqueConstraint("organization_id", "station_number", name="station_number"),
        Index("ix_stations_org_battalion", "organization_id", "battalion_id"),
    )

    station_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    battalion_id: Mapped[str | None] = mapped_column(
        ForeignKey("battalions.battalion_id", ondelete="SET NULL")
    )
    station_number: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    district: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(240))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class CertificationType(Base):
    __tablename__ = "certification_types"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="certification_code"),
    )

    certification_type_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    category: Mapped[str | None] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(Text)
    validity_days: Mapped[int | None] = mapped_column(Integer)


class Personnel(Base):
    __tablename__ = "personnel"
    __table_args__ = (
        Index("ix_personnel_org_station_status", "organization_id", "station_id", "availability_status"),
    )

    personnel_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    station_id: Mapped[str | None] = mapped_column(ForeignKey("stations.station_id", ondelete="SET NULL"))
    current_unit_id: Mapped[str | None] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    rank: Mapped[str | None] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(120), nullable=False)
    availability_status: Mapped[str] = mapped_column(String(40), nullable=False, default="AVAILABLE")
    last_check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class PersonnelCertification(Base):
    __tablename__ = "personnel_certifications"
    __table_args__ = (
        UniqueConstraint("personnel_id", "certification_type_id", name="personnel_certification"),
        Index("ix_personnel_certifications_expiration", "organization_id", "expires_at"),
    )

    personnel_certification_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False
    )
    personnel_id: Mapped[str] = mapped_column(
        ForeignKey("personnel.personnel_id", ondelete="CASCADE"), nullable=False
    )
    certification_type_id: Mapped[str] = mapped_column(
        ForeignKey("certification_types.certification_type_id", ondelete="CASCADE"), nullable=False
    )
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="ACTIVE")


class Unit(Base):
    __tablename__ = "units"
    __table_args__ = (
        UniqueConstraint("organization_id", "call_sign", name="unit_call_sign"),
        Index("ix_units_org_station_status", "organization_id", "station_id", "operational_status"),
    )

    unit_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    station_id: Mapped[str | None] = mapped_column(ForeignKey("stations.station_id", ondelete="SET NULL"))
    call_sign: Mapped[str] = mapped_column(String(80), nullable=False)
    unit_type: Mapped[str] = mapped_column(String(50), nullable=False)
    minimum_staff: Mapped[int] = mapped_column(Integer, nullable=False)
    operational_status: Mapped[str] = mapped_column(String(40), nullable=False, default="AVAILABLE")
    required_certification_codes: Mapped[list[str]] = mapped_column(JSON_DOCUMENT, nullable=False, default=list)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class Shift(Base):
    __tablename__ = "shifts"
    __table_args__ = (
        Index("ix_shifts_org_window", "organization_id", "start_time", "end_time"),
    )

    shift_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    station_id: Mapped[str | None] = mapped_column(ForeignKey("stations.station_id", ondelete="SET NULL"))
    unit_id: Mapped[str | None] = mapped_column(ForeignKey("units.unit_id", ondelete="SET NULL"))
    watch: Mapped[str | None] = mapped_column(String(20))
    location: Mapped[str] = mapped_column(String(180), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    required_headcount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="SCHEDULED")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class UnitAssignment(Base):
    __tablename__ = "unit_assignments"
    __table_args__ = (
        Index("ix_assignments_org_window", "organization_id", "shift_start", "shift_end"),
        Index("ix_assignments_personnel_window", "personnel_id", "shift_start", "shift_end"),
    )

    assignment_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.unit_id", ondelete="CASCADE"), nullable=False)
    personnel_id: Mapped[str] = mapped_column(
        ForeignKey("personnel.personnel_id", ondelete="CASCADE"), nullable=False
    )
    shift_id: Mapped[str | None] = mapped_column(ForeignKey("shifts.shift_id", ondelete="SET NULL"))
    shift_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    shift_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    assignment_status: Mapped[str] = mapped_column(String(40), nullable=False)
    clocked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clocked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)


class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = (
        Index("ix_incidents_org_active_priority", "organization_id", "is_active", "priority"),
    )

    incident_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    station_id: Mapped[str | None] = mapped_column(ForeignKey("stations.station_id", ondelete="SET NULL"))
    primary_unit_id: Mapped[str | None] = mapped_column(ForeignKey("units.unit_id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(220), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="ACTIVE")
    commander: Mapped[str | None] = mapped_column(String(180))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(80), nullable=False, default="DEMO")
    source_reference: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class IncidentUnit(Base):
    __tablename__ = "incident_units"
    __table_args__ = (
        UniqueConstraint("incident_id", "unit_id", name="incident_unit"),
    )

    incident_unit_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    incident_id: Mapped[str] = mapped_column(
        ForeignKey("incidents.incident_id", ondelete="CASCADE"), nullable=False
    )
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.unit_id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="ASSIGNED")
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        Index("ix_alerts_org_state_created", "organization_id", "state", "created_at"),
    )

    alert_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    incident_id: Mapped[str | None] = mapped_column(ForeignKey("incidents.incident_id", ondelete="SET NULL"))
    unit_id: Mapped[str | None] = mapped_column(ForeignKey("units.unit_id", ondelete="SET NULL"))
    station_id: Mapped[str | None] = mapped_column(ForeignKey("stations.station_id", ondelete="SET NULL"))
    personnel_id: Mapped[str | None] = mapped_column(ForeignKey("personnel.personnel_id", ondelete="SET NULL"))
    alert_type: Mapped[str] = mapped_column(String(60), nullable=False)
    priority: Mapped[str] = mapped_column(String(30), nullable=False, default="HIGH")
    state: Mapped[str] = mapped_column(String(30), nullable=False, default="OPEN")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(JSON_DOCUMENT, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledged_by: Mapped[str | None] = mapped_column(String(180))
    acknowledged_note: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RenewalTask(Base):
    __tablename__ = "renewal_tasks"
    __table_args__ = (
        Index("ix_renewals_org_status_due", "organization_id", "status", "due_date"),
    )

    renewal_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    personnel_id: Mapped[str] = mapped_column(
        ForeignKey("personnel.personnel_id", ondelete="CASCADE"), nullable=False
    )
    certification_code: Mapped[str] = mapped_column(String(60), nullable=False)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    owner: Mapped[str | None] = mapped_column(String(180))
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        Index("ix_audit_org_created", "organization_id", "created_at"),
        Index("ix_audit_org_entity", "organization_id", "entity_type", "entity_id"),
    )

    audit_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(80), nullable=False)
    actor_subject: Mapped[str] = mapped_column(String(180), nullable=False)
    actor_display: Mapped[str | None] = mapped_column(String(180))
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(JSON_DOCUMENT, nullable=False, default=dict)
    request_id: Mapped[str | None] = mapped_column(String(80))
    previous_hash: Mapped[str | None] = mapped_column(String(64))
    event_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="outbox_idempotency"),
        Index("ix_outbox_pending", "published_at", "available_at"),
    )

    outbox_event_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(180), nullable=False)
    topic_class: Mapped[str] = mapped_column(String(30), nullable=False)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    aggregate_type: Mapped[str] = mapped_column(String(80), nullable=False)
    aggregate_id: Mapped[str] = mapped_column(String(80), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON_DOCUMENT, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text)


class RealtimeTicket(Base):
    __tablename__ = "realtime_tickets"
    __table_args__ = (Index("ix_realtime_ticket_expiry", "expires_at"),)

    ticket_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[str] = mapped_column(String(180), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


TENANT_TABLE_NAMES = tuple(
    table.name
    for table in Base.metadata.sorted_tables
    if "organization_id" in table.c and table.name != "organizations"
)
