"""Transactional outbox creation and publication."""

from __future__ import annotations

from datetime import datetime, timezone
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import OutboxEvent
from app.models import EventEnvelope


def enqueue_event(session: Session, envelope: EventEnvelope) -> OutboxEvent:
    existing = session.scalar(
        select(OutboxEvent).where(
            OutboxEvent.organization_id == envelope.organization_id,
            OutboxEvent.idempotency_key == envelope.event_id,
        )
    )
    if existing:
        return existing
    record = OutboxEvent(
        outbox_event_id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{envelope.organization_id}:{envelope.event_id}")),
        organization_id=envelope.organization_id,
        idempotency_key=envelope.event_id,
        topic_class=envelope.topic_class,
        event_type=envelope.event_type,
        aggregate_type=envelope.aggregate_type,
        aggregate_id=envelope.aggregate_id,
        payload=envelope.model_dump(mode="json"),
        occurred_at=envelope.occurred_at,
        available_at=datetime.now(timezone.utc),
    )
    session.add(record)
    session.flush()
    return record
