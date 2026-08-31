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
