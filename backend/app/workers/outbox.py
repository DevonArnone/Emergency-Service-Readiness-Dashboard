"""Publish committed outbox records without cross-tenant leakage."""

from __future__ import annotations

import logging
import signal
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.config import settings
from app.db.models import Organization, OutboxEvent
from app.db.session import session_scope
from app.models import EventEnvelope
from app.services.kafka_service import get_kafka_service


logger = logging.getLogger(__name__)
running = True


def stop(*_args) -> None:
    global running
    running = False


def publish_batch(limit: int = 250) -> int:
    published = 0
    producer = get_kafka_service()
    with session_scope() as root_session:
        organization_ids = list(root_session.scalars(select(Organization.organization_id)))
    for organization_id in organization_ids:
        with session_scope(organization_id) as session:
            records = list(session.scalars(
                select(OutboxEvent)
                .where(
                    OutboxEvent.published_at.is_(None),
                    OutboxEvent.available_at <= datetime.now(timezone.utc),
                )
                .order_by(OutboxEvent.occurred_at)
                .limit(limit)
                .with_for_update(skip_locked=True)
            ))
            for record in records:
                envelope = EventEnvelope.model_validate(record.payload)
                if producer.publish(envelope):
                    record.published_at = datetime.now(timezone.utc)
                    record.last_error = None
                    published += 1
                else:
                    record.attempts += 1
                    record.last_error = "producer_rejected"
                    record.available_at = datetime.now(timezone.utc) + timedelta(
                        seconds=min(60, 2 ** min(record.attempts, 6))
                    )
    return published


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    logger.info("Outbox worker started with %s pipeline", settings.pipeline_profile)
    while running:
        count = publish_batch()
        if not count:
            time.sleep(0.25)


if __name__ == "__main__":
    main()
