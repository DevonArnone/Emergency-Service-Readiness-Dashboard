"""Mapping-compatible adapters backed by the normalized relational schema."""

from __future__ import annotations

import hashlib
import re
import uuid
from collections.abc import Iterable, Iterator, MutableMapping
from datetime import datetime, timezone
from enum import Enum
from typing import Generic, TypeVar

from pydantic import BaseModel
from fastapi import HTTPException
from sqlalchemy import delete, select

from app.config import settings
from app.db.models import (
    Alert as AlertRow,
    AuditEvent as AuditEventRow,
    Battalion,
    CertificationType,
    Incident as IncidentRow,
    IncidentUnit,
    Organization,
    Personnel as PersonnelRow,
    PersonnelCertification,
    RenewalTask as RenewalTaskRow,
    Shift as ShiftRow,
    Station as StationRow,
    Unit as UnitRow,
    UnitAssignment as UnitAssignmentRow,
)
from app.db.session import session_scope
from app.models import (
    AuditEvent,
    Certification,
    OperationalIncident,
    Personnel,
    ReadinessAlert,
    RenewalTask,
    Shift,
    Station,
    Unit,
    UnitAssignment,
)
from app.security.tenant import current_organization_id


ModelT = TypeVar("ModelT", bound=BaseModel)


def _value(value):
    return value.value if isinstance(value, Enum) else value


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _organization_id() -> str:
    return current_organization_id() or settings.default_organization_id


def _ensure_organization(session, organization_id: str) -> None:
    if session.get(Organization, organization_id) is None:
        if organization_id != settings.default_organization_id:
            raise HTTPException(status_code=403, detail="Organization is not provisioned")
        session.add(Organization(
            organization_id=organization_id,
            slug="fairfax-concept" if organization_id == settings.default_organization_id else organization_id,
            name="Fairfax County Fire and Rescue Department — Unofficial Concept",
            is_public_demo=organization_id == settings.default_organization_id,
        ))
        session.flush()


class RelationalStore(MutableMapping[str, ModelT], Generic[ModelT]):
    """Expose normalized SQL rows through the mapping API used by the services."""

    def __init__(self, kind: str, model: type[ModelT]):
        self.kind = kind
        self.model = model

    def __getitem__(self, key: str) -> ModelT:
        value = self.get(key)
        if value is None:
            raise KeyError(key)
        return value

    def get(self, key: str, default=None):
        values = _load_all(self.kind, _organization_id(), key)
        return values[0] if values else default

    def __setitem__(self, key: str, value: ModelT) -> None:
        validated = self.model.model_validate(value)
        id_field = _ID_FIELDS[self.kind]
        if getattr(validated, id_field, None) != key:
            validated = validated.model_copy(update={id_field: key})
        self.bulk_set([(key, validated)])

    def bulk_set(self, values: Iterable[tuple[str, ModelT]]) -> None:
        organization_id = _organization_id()
        with session_scope(organization_id) as session:
            _ensure_organization(session, organization_id)
            for key, raw in values:
                value = self.model.model_validate(raw)
                id_field = _ID_FIELDS[self.kind]
                if getattr(value, id_field, None) != key:
                    value = value.model_copy(update={id_field: key})
                _save(self.kind, session, organization_id, value)
                _enqueue_change(session, organization_id, self.kind, key, value)

    def __delitem__(self, key: str) -> None:
        organization_id = _organization_id()
        row_type, id_column = _ROW_KEYS[self.kind]
        with session_scope(organization_id) as session:
            result = session.execute(
                delete(row_type).where(
                    id_column == key,
                    row_type.organization_id == organization_id,
                )
            )
            if not result.rowcount:
                raise KeyError(key)
            _enqueue_change(session, organization_id, self.kind, key, None)

    def __iter__(self) -> Iterator[str]:
        return iter(dict(self.items()))

    def __len__(self) -> int:
        organization_id = _organization_id()
        row_type, id_column = _ROW_KEYS[self.kind]
        with session_scope(organization_id) as session:
            return len(session.scalars(
                select(id_column).where(row_type.organization_id == organization_id)
            ).all())

    def items(self):
        values = _load_all(self.kind, _organization_id())
        id_field = _ID_FIELDS[self.kind]
        return [(getattr(value, id_field), value) for value in values]

    def values(self):
        return _load_all(self.kind, _organization_id())

    def clear(self) -> None:
        organization_id = _organization_id()
        row_type, _ = _ROW_KEYS[self.kind]
        with session_scope(organization_id) as session:
            session.execute(delete(row_type).where(row_type.organization_id == organization_id))


def clear_operational_data(organization_id: str | None = None) -> None:
    """Clear one tenant in dependency-safe order without touching other tenants."""
    target = organization_id or _organization_id()
    ordered = (
        IncidentUnit,
        PersonnelCertification,
        UnitAssignmentRow,
        RenewalTaskRow,
        AlertRow,
        AuditEventRow,
        IncidentRow,
        ShiftRow,
        PersonnelRow,
        UnitRow,
        StationRow,
        Battalion,
        CertificationType,
    )
    with session_scope(target) as session:
        for row_type in ordered:
            session.execute(delete(row_type).where(row_type.organization_id == target))


def _load_all(kind: str, organization_id: str, key: str | None = None) -> list[BaseModel]:
    row_type, id_column = _ROW_KEYS[kind]
    with session_scope(organization_id) as session:
        query = select(row_type).where(row_type.organization_id == organization_id)
        if key is not None:
            query = query.where(id_column == key)
        rows = session.scalars(query).all()
        if not rows:
            return []
        if kind == "personnel":
            associations = session.execute(
                select(PersonnelCertification, CertificationType)
                .join(CertificationType, PersonnelCertification.certification_type_id == CertificationType.certification_type_id)
                .where(PersonnelCertification.organization_id == organization_id)
                .where(PersonnelCertification.personnel_id.in_([row.personnel_id for row in rows]))
            ).all()
            certs: dict[str, list[tuple[PersonnelCertification, CertificationType]]] = {}
            for association, certification in associations:
                certs.setdefault(association.personnel_id, []).append((association, certification))
            return [_personnel_from_row(row, certs.get(row.personnel_id, [])) for row in rows]
        if kind == "stations":
            units = session.execute(
                select(UnitRow.station_id, UnitRow.unit_id).where(UnitRow.organization_id == organization_id)
            ).all()
            unit_ids: dict[str, list[str]] = {}
            for station_id, unit_id in units:
                if station_id:
                    unit_ids.setdefault(station_id, []).append(unit_id)
            return [_station_from_row(row, unit_ids.get(row.station_id, [])) for row in rows]
        if kind == "incidents":
            links = session.execute(
                select(IncidentUnit.incident_id, IncidentUnit.unit_id).where(
                    IncidentUnit.organization_id == organization_id
                )
            ).all()
            assigned: dict[str, list[str]] = {}
            for incident_id, unit_id in links:
                assigned.setdefault(incident_id, []).append(unit_id)
            return [_incident_from_row(row, assigned.get(row.incident_id, [])) for row in rows]
        return [_FROM_ROW[kind](row) for row in rows]


def _personnel_from_row(row: PersonnelRow, certs) -> Personnel:
    expirations = {
        certification.code: _aware(association.expires_at)
        for association, certification in certs
        if association.expires_at
    }
    return Personnel(
        personnel_id=row.personnel_id,
        name=row.name,
        rank=row.rank,
        role=row.role,
        certifications=sorted(certification.code for _, certification in certs),
        cert_expirations=expirations,
        availability_status=row.availability_status,
        last_check_in=_aware(row.last_check_in),
        station_id=row.station_id,
        current_unit_id=row.current_unit_id,
        notes=row.notes,
        is_archived=row.is_archived,
    )


def _station_from_row(row: StationRow, unit_ids: list[str]) -> Station:
    return Station(
        station_id=row.station_id,
        name=row.name,
        district=row.district,
        address=row.address,
        unit_ids=sorted(unit_ids),
        latitude=row.latitude,
        longitude=row.longitude,
    )


def _incident_from_row(row: IncidentRow, assigned_unit_ids: list[str]) -> OperationalIncident:
    return OperationalIncident(
        incident_id=row.incident_id,
        title=row.title,
        description=row.description,
        priority=row.priority,
        station_id=row.station_id,
        unit_id=row.primary_unit_id,
        is_active=row.is_active,
        created_at=_aware(row.created_at),
        resolved_at=_aware(row.resolved_at),
        assigned_unit_ids=sorted(assigned_unit_ids),
        commander=row.commander,
    )


def _unit_from_row(row: UnitRow) -> Unit:
    return Unit(
        unit_id=row.unit_id,
        unit_name=row.call_sign,
        type=row.unit_type,
        minimum_staff=row.minimum_staff,
        required_certifications=row.required_certification_codes or [],
        station_id=row.station_id,
        operational_status=row.operational_status,
        is_archived=row.is_archived,
    )


def _assignment_from_row(row: UnitAssignmentRow) -> UnitAssignment:
    return UnitAssignment(
        assignment_id=row.assignment_id,
        unit_id=row.unit_id,
        personnel_id=row.personnel_id,
        shift_start=_aware(row.shift_start),
        shift_end=_aware(row.shift_end),
        assignment_status=row.assignment_status,
        shift_id=row.shift_id,
        clocked_in_at=_aware(row.clocked_in_at),
        clocked_out_at=_aware(row.clocked_out_at),
        notes=row.notes,
    )


def _certification_from_row(row: CertificationType) -> Certification:
    return Certification(
        certification_id=row.certification_type_id,
        name=row.code,
        description=row.description or row.name,
        category=row.category,
        typical_validity_days=row.validity_days,
    )


def _alert_from_row(row: AlertRow) -> ReadinessAlert:
    return ReadinessAlert(
        alert_id=row.alert_id,
        alert_type=row.alert_type,
        state=row.state,
        unit_id=row.unit_id,
        station_id=row.station_id,
        personnel_id=row.personnel_id,
        message=row.message,
        details=row.details,
        created_at=_aware(row.created_at),
        acknowledged_at=_aware(row.acknowledged_at),
        acknowledged_by=row.acknowledged_by,
        acknowledged_note=row.acknowledged_note,
        resolved_at=_aware(row.resolved_at),
    )


def _shift_from_row(row: ShiftRow) -> Shift:
    return Shift(
        shift_id=row.shift_id,
        location=row.location,
        start_time=_aware(row.start_time),
        end_time=_aware(row.end_time),
        required_headcount=row.required_headcount,
        station_id=row.station_id,
        unit_id=row.unit_id,
        status=row.status,
        notes=row.notes,
        created_at=_aware(row.created_at),
    )


def _renewal_from_row(row: RenewalTaskRow) -> RenewalTask:
    return RenewalTask(
        renewal_id=row.renewal_id,
        personnel_id=row.personnel_id,
        certification=row.certification_code,
        due_date=_aware(row.due_date),
        status=row.status,
        owner=row.owner,
        scheduled_for=_aware(row.scheduled_for),
        notes=row.notes,
        created_at=_aware(row.created_at),
        completed_at=_aware(row.completed_at),
    )


def _audit_from_row(row: AuditEventRow) -> AuditEvent:
    return AuditEvent(
        audit_id=row.audit_id,
        action=row.action,
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        actor=row.actor_display or row.actor_subject,
        summary=row.summary,
        details=row.details,
        previous_hash=row.previous_hash,
        event_hash=row.event_hash,
        created_at=_aware(row.created_at),
    )


def _enqueue_change(session, organization_id: str, kind: str, key: str, value: BaseModel | None) -> None:
    from app.models import EventEnvelope, EventPriority
    from app.services.outbox_service import enqueue_event
    # Send identifiers and operational state, not names, free text, or credential details.
    fields = {"station_id", "unit_id", "personnel_id", "shift_id", "priority", "state",
              "is_active", "operational_status", "assignment_status", "availability_status", "minimum_staff"}
    payload = value.model_dump(mode="json", include=fields) if value else {"deleted": True}
    urgent = kind == "alerts" or (kind == "incidents" and payload.get("priority") in {"HIGH", "CRITICAL"})
    aggregate_type = {"incidents": "incident", "alerts": "alert", "units": "unit", "shifts": "shift"}.get(kind, kind)
    enqueue_event(session, EventEnvelope(
        event_id=str(uuid.uuid4()), organization_id=organization_id, source="aegis-api",
        event_type=f"{aggregate_type}.{'updated' if value else 'deleted'}",
        priority=EventPriority.HIGH if urgent else EventPriority.NORMAL,
        topic_class="alert" if urgent else "audit" if kind == "audit_events" else "bulk",
        occurred_at=datetime.now(timezone.utc), aggregate_type=aggregate_type, aggregate_id=key, payload=payload,
    ))


def _save(kind: str, session, organization_id: str, value: BaseModel) -> None:
    row_type, _ = _ROW_KEYS[kind]
    existing_row = session.get(row_type, getattr(value, _ID_FIELDS[kind]))
    if existing_row is not None and existing_row.organization_id != organization_id:
        raise HTTPException(status_code=409, detail="Record identifier is unavailable")
    references = {
        "station_id": StationRow, "unit_id": UnitRow, "current_unit_id": UnitRow,
        "personnel_id": PersonnelRow, "shift_id": ShiftRow,
    }
    for field, target in references.items():
        if field == _ID_FIELDS[kind]:
            continue
        key = getattr(value, field, None)
        if key:
            row = session.get(target, key)
            if row is None or row.organization_id != organization_id:
                raise HTTPException(status_code=422, detail=f"{field} must reference a record in your organization")
    for unit_id in getattr(value, "assigned_unit_ids", []) or []:
        row = session.get(UnitRow, unit_id)
        if row is None or row.organization_id != organization_id:
            raise HTTPException(status_code=422, detail="Assigned units must belong to your organization")
    if kind == "personnel":
        row = PersonnelRow(
            personnel_id=value.personnel_id, organization_id=organization_id,
            station_id=value.station_id, current_unit_id=value.current_unit_id,
            name=value.name, rank=value.rank, role=value.role,
            availability_status=_value(value.availability_status), last_check_in=value.last_check_in,
            notes=value.notes, is_archived=value.is_archived,
        )
        session.merge(row)
        session.flush()
        session.execute(delete(PersonnelCertification).where(
            PersonnelCertification.organization_id == organization_id,
            PersonnelCertification.personnel_id == value.personnel_id,
        ))
        existing = {
            certification.code: certification
            for certification in session.scalars(select(CertificationType).where(
                CertificationType.organization_id == organization_id,
                CertificationType.code.in_(value.certifications or ["__none__"]),
            )).all()
        }
        for code in value.certifications:
            certification = existing.get(code)
            if certification is None:
                certification = CertificationType(
                    certification_type_id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{organization_id}:cert:{code}")),
                    organization_id=organization_id, code=code, name=code,
                )
                session.merge(certification)
                session.flush()
            session.add(PersonnelCertification(
                personnel_certification_id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{organization_id}:pc:{value.personnel_id}:{certification.certification_type_id}")),
                organization_id=organization_id,
                personnel_id=value.personnel_id,
                certification_type_id=certification.certification_type_id,
                expires_at=value.cert_expirations.get(code),
                status="ACTIVE",
            ))
        return
    if kind == "units":
        session.merge(UnitRow(
            unit_id=value.unit_id, organization_id=organization_id, station_id=value.station_id,
            call_sign=value.unit_name, unit_type=_value(value.type), minimum_staff=value.minimum_staff,
            operational_status=_value(value.operational_status),
            required_certification_codes=value.required_certifications,
            is_archived=value.is_archived,
        ))
        return
    if kind == "unit_assignments":
        session.merge(UnitAssignmentRow(
            assignment_id=value.assignment_id, organization_id=organization_id,
            unit_id=value.unit_id, personnel_id=value.personnel_id, shift_id=value.shift_id,
            shift_start=value.shift_start, shift_end=value.shift_end,
            assignment_status=_value(value.assignment_status), clocked_in_at=value.clocked_in_at,
            clocked_out_at=value.clocked_out_at, notes=value.notes,
        ))
        return
    if kind == "certifications":
        session.merge(CertificationType(
            certification_type_id=value.certification_id, organization_id=organization_id,
            code=value.name, name=value.description or value.name, description=value.description,
            category=value.category, validity_days=value.typical_validity_days,
        ))
        return
    if kind == "stations":
        number_match = re.search(r"\d+", value.station_id or value.name)
        session.merge(StationRow(
            station_id=value.station_id, organization_id=organization_id,
            station_number=number_match.group(0).lstrip("0") or "0" if number_match else value.station_id,
            name=value.name, district=value.district, address=value.address,
            latitude=value.latitude, longitude=value.longitude,
        ))
        return
    if kind == "alerts":
        session.merge(AlertRow(
            alert_id=value.alert_id, organization_id=organization_id, unit_id=value.unit_id,
            station_id=value.station_id, personnel_id=value.personnel_id,
            alert_type=_value(value.alert_type), state=_value(value.state), message=value.message,
            details=value.details or {}, created_at=value.created_at or datetime.now(timezone.utc),
            acknowledged_at=value.acknowledged_at, acknowledged_by=value.acknowledged_by,
            acknowledged_note=value.acknowledged_note, resolved_at=value.resolved_at,
        ))
        return
    if kind == "incidents":
        session.merge(IncidentRow(
            incident_id=value.incident_id, organization_id=organization_id, station_id=value.station_id,
            primary_unit_id=value.unit_id, title=value.title, description=value.description,
            priority=_value(value.priority), status="ACTIVE" if value.is_active else "RESOLVED",
            commander=value.commander, source="SYNTHETIC_DEMO",
            created_at=value.created_at or datetime.now(timezone.utc), resolved_at=value.resolved_at,
            is_active=value.is_active,
        ))
        session.flush()
        session.execute(delete(IncidentUnit).where(
            IncidentUnit.organization_id == organization_id,
            IncidentUnit.incident_id == value.incident_id,
        ))
        assigned = list(dict.fromkeys(value.assigned_unit_ids or ([value.unit_id] if value.unit_id else [])))
        for unit_id in assigned:
            session.add(IncidentUnit(
                incident_unit_id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{organization_id}:iu:{value.incident_id}:{unit_id}")),
                organization_id=organization_id, incident_id=value.incident_id, unit_id=unit_id,
            ))
        return
    if kind == "shifts":
        session.merge(ShiftRow(
            shift_id=value.shift_id, organization_id=organization_id, station_id=value.station_id,
            unit_id=value.unit_id, location=value.location, start_time=value.start_time,
            end_time=value.end_time, required_headcount=value.required_headcount,
            status=value.status, notes=value.notes,
            created_at=value.created_at or datetime.now(timezone.utc),
        ))
        return
    if kind == "renewal_tasks":
        session.merge(RenewalTaskRow(
            renewal_id=value.renewal_id, organization_id=organization_id,
            personnel_id=value.personnel_id, certification_code=value.certification,
            due_date=value.due_date, status=_value(value.status), owner=value.owner,
            scheduled_for=value.scheduled_for, notes=value.notes,
            created_at=value.created_at or datetime.now(timezone.utc), completed_at=value.completed_at,
        ))
        return
    if kind == "audit_events":
        event_hash = value.event_hash or hashlib.sha256(
            f"{value.audit_id}:{value.action}:{value.entity_id}:{value.created_at}".encode()
        ).hexdigest()
        session.merge(AuditEventRow(
            audit_id=value.audit_id, organization_id=organization_id, action=value.action,
            entity_type=value.entity_type, entity_id=value.entity_id,
            actor_subject=value.actor, actor_display=value.actor, summary=value.summary,
            details=value.details, previous_hash=value.previous_hash, event_hash=event_hash,
            created_at=value.created_at or datetime.now(timezone.utc),
        ))
        return
    raise ValueError(f"Unsupported relational store kind: {kind}")


_ID_FIELDS = {
    "personnel": "personnel_id", "units": "unit_id", "unit_assignments": "assignment_id",
    "certifications": "certification_id", "stations": "station_id", "alerts": "alert_id",
    "incidents": "incident_id", "shifts": "shift_id", "renewal_tasks": "renewal_id",
    "audit_events": "audit_id",
}

_ROW_KEYS = {
    "personnel": (PersonnelRow, PersonnelRow.personnel_id),
    "units": (UnitRow, UnitRow.unit_id),
    "unit_assignments": (UnitAssignmentRow, UnitAssignmentRow.assignment_id),
    "certifications": (CertificationType, CertificationType.certification_type_id),
    "stations": (StationRow, StationRow.station_id),
    "alerts": (AlertRow, AlertRow.alert_id),
    "incidents": (IncidentRow, IncidentRow.incident_id),
    "shifts": (ShiftRow, ShiftRow.shift_id),
    "renewal_tasks": (RenewalTaskRow, RenewalTaskRow.renewal_id),
    "audit_events": (AuditEventRow, AuditEventRow.audit_id),
}

_FROM_ROW = {
    "units": _unit_from_row,
    "unit_assignments": _assignment_from_row,
    "certifications": _certification_from_row,
    "alerts": _alert_from_row,
    "shifts": _shift_from_row,
    "renewal_tasks": _renewal_from_row,
    "audit_events": _audit_from_row,
}
