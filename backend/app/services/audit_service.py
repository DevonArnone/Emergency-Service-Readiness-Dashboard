"""Audit helpers for operational mutations."""
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
    event = AuditEvent(
        audit_id=f"audit-{uuid4().hex[:12]}",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor=actor,
        summary=summary,
        details=details or {},
        created_at=datetime.now(timezone.utc),
    )
    audit_events_store[event.audit_id] = event
    return event
