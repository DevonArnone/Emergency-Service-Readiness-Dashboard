"""Idempotent integration ingress for CAD, AVL, staffing, and apparatus feeds."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.db.models import Organization
from app.db.session import session_scope
from app.models import EventEnvelope, IngestEventRequest
from app.security.identity import Principal, require_roles
from app.services.outbox_service import enqueue_event


router = APIRouter(prefix="/api/v1/ingest", tags=["ingestion"])


@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
async def ingest_event(
    body: IngestEventRequest,
    principal: Principal = Depends(require_roles("integration_service", "admin")),
) -> dict:
    organization_id = body.organization_id or principal.organization_id
    if organization_id != principal.organization_id:
        raise HTTPException(status_code=403, detail="Organization scope does not permit this event")
    envelope = EventEnvelope(
        event_id=body.event_id or str(uuid.uuid4()),
        organization_id=organization_id,
        source=body.source,
        event_type=body.event_type,
        priority=body.priority,
        topic_class=body.topic_class,
        occurred_at=body.occurred_at or datetime.now(timezone.utc),
        schema_version=body.schema_version,
        aggregate_type=body.aggregate_type,
        aggregate_id=body.aggregate_id,
        payload=body.payload,
    )
    with session_scope(organization_id) as session:
        if not session.get(Organization, organization_id):
            raise HTTPException(status_code=403, detail="Organization is not provisioned")
        record = enqueue_event(session, envelope)
    return {
        "status": "accepted",
        "event_id": envelope.event_id,
        "outbox_event_id": record.outbox_event_id,
        "schema_version": envelope.schema_version,
    }
