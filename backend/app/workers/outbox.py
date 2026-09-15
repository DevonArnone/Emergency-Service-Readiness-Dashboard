"""Publish committed outbox records without cross-tenant leakage."""

from __future__ import annotations

import logging
import argparse
import signal
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.config import settings
from app.db.models import Organization, OutboxEvent
from app.db.session import session_scope
from app.models import EventEnvelope
from app.services.kafka_service import KafkaService, get_kafka_service


logger = logging.getLogger(__name__)
running = True


def stop(*_args) -> None:
    global running
    running = False


def publish_batch(limit: int = 250, stream: str = "all") -> int:
    published = 0
    producer = get_kafka_service()
    if not isinstance(producer, KafkaService):
        raise RuntimeError("The durable outbox worker requires a real Kafka producer")
    if settings.pipeline_profile == "baseline" and stream == "alerts":
        return 0
    with session_scope() as root_session:
        organization_ids = list(root_session.scalars(select(Organization.organization_id)))
    for organization_id in organization_ids:
        with session_scope(organization_id) as session:
            query = select(OutboxEvent)
            if settings.pipeline_profile != "baseline" and stream != "all":
                query = query.where(OutboxEvent.topic_class == "alert" if stream == "alerts" else OutboxEvent.topic_class != "alert")
            records = list(session.scalars(
                query
                .where(
                    OutboxEvent.organization_id == organization_id,
                    OutboxEvent.published_at.is_(None),
                    OutboxEvent.available_at <= datetime.now(timezone.utc),
                )
                .order_by(OutboxEvent.occurred_at)
                .limit(limit)
                .with_for_update(skip_locked=True)
            ))
            if not records:
                continue
            confirmed = producer.publish_confirmed([EventEnvelope.model_validate(record.payload) for record in records])
            for record in records:
                if record.idempotency_key in confirmed:
                    record.published_at = datetime.now(timezone.utc)
                    record.last_error = None
                    published += 1
                else:
                    record.attempts += 1
                    record.last_error = "broker_delivery_unconfirmed"
                    record.available_at = datetime.now(timezone.utc) + timedelta(
                        seconds=min(60, 2 ** min(record.attempts, 6))
                    )
    return published


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--stream', choices=['alerts', 'bulk', 'all'], default='all')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    logger.info("Outbox worker started with %s pipeline", settings.pipeline_profile)
    while running:
        try:
            count = publish_batch(stream=args.stream)
        except Exception:
            logger.exception("Outbox publish cycle failed; committed records remain pending")
            time.sleep(1)
            continue
        if not count:
            time.sleep(0.01)


if __name__ == "__main__":
    main()
