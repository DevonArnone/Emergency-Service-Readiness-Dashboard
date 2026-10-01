"""Audit helpers for operational mutations."""
import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4

from app.models import AuditEvent
from app.stores import audit_events_store


def record_audit(
    action: str,
    entity_type: str,
    entity_id: str,
    summary: str,
    *,
    actor: str = "Duty Officer",
    details: dict | None = None,
) -> AuditEvent:
    previous = max(
        audit_events_store.values(),
        key=lambda item: item.created_at or datetime.min.replace(tzinfo=timezone.utc),
        default=None,
    )
    previous_hash = previous.event_hash if previous else None
    created_at = datetime.now(timezone.utc)
    canonical = json.dumps(
        {
            "action": action,
            "actor": actor,
            "created_at": created_at.isoformat(),
            "details": details or {},
            "entity_id": entity_id,
            "entity_type": entity_type,
            "previous_hash": previous_hash,
            "summary": summary,
        },
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    event = AuditEvent(
        audit_id=f"audit-{uuid4().hex[:12]}",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor=actor,
        summary=summary,
        details=details or {},
        previous_hash=previous_hash,
        event_hash=hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        created_at=created_at,
    )
    audit_events_store[event.audit_id] = event
    return event


def _status(value) -> str | None:
    if value is None:
        return None
    return value.value if hasattr(value, "value") else str(value)


def incident_lifecycle_details(before, after, *, recorded_at: datetime | None = None) -> dict:
    """Additive, timestamped incident lifecycle facts used to reconstruct recorded timelines."""
    before_units = list(getattr(before, "assigned_unit_ids", None) or []) if before is not None else []
    after_units = list(getattr(after, "assigned_unit_ids", None) or [])
    return {
        "lifecycle": True,
        "recorded_at": (recorded_at or datetime.now(timezone.utc)).isoformat(),
        "before_status": _status(getattr(before, "status", None)) if before is not None else None,
        "after_status": _status(getattr(after, "status", None)),
        "assigned_unit_ids_before": before_units,
        "assigned_unit_ids": after_units,
        "units_added": [unit_id for unit_id in after_units if unit_id not in before_units],
        "units_released": [unit_id for unit_id in before_units if unit_id not in after_units],
    }


def unit_service_details(before, after, *, recorded_at: datetime | None = None) -> dict:
    """Additive, timestamped unit service-state facts; absent history is never inferred."""
    return {
        "service_state": True,
        "recorded_at": (recorded_at or datetime.now(timezone.utc)).isoformat(),
        "before_status": _status(getattr(before, "operational_status", None)) if before is not None else None,
        "after_status": _status(getattr(after, "operational_status", None)),
    }
