"""Reliable Kafka producer with isolated priority and bulk topics."""

from __future__ import annotations

import logging
import threading
import time
import uuid
from datetime import timezone
from typing import Any, Protocol

try:
    from confluent_kafka import Producer
    from confluent_kafka.admin import AdminClient, NewTopic, NewPartitions

    KAFKA_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised by the local fallback
    Producer = None
    AdminClient = None
    NewTopic = None
    KAFKA_AVAILABLE = False

from app.config import settings
from app.models import EventEnvelope, EventPriority, ShiftEvent
from app.security.tenant import current_organization_id


logger = logging.getLogger(__name__)


class ProducerLike(Protocol):
    def produce(self, *args: Any, **kwargs: Any) -> None: ...
    def poll(self, timeout: float) -> int: ...
    def flush(self, timeout: float | None = None) -> int: ...


def topic_for(envelope: EventEnvelope, *, profile: str = "optimized") -> str:
    if profile == "baseline":
        return settings.kafka_shared_topic
    return {
        "alert": settings.kafka_alert_topic,
        "audit": settings.kafka_audit_topic,
        "bulk": settings.kafka_event_topic,
    }[envelope.topic_class]


def producer_config() -> dict[str, Any]:
    config: dict[str, Any] = {
        "bootstrap.servers": settings.kafka_bootstrap_servers,
        "acks": "all",
        "enable.idempotence": True,
        "compression.type": "zstd",
        "linger.ms": 5,
        "batch.num.messages": 10000,
        "message.send.max.retries": 10,
        "retry.backoff.ms": 100,
        "delivery.timeout.ms": 30000,
        "client.id": settings.kafka_client_id,
    }
    if settings.kafka_username != "placeholder" and settings.kafka_password != "placeholder":
        config.update({
            "security.protocol": "SASL_SSL",
            "sasl.mechanisms": "PLAIN",
            "sasl.username": settings.kafka_username,
            "sasl.password": settings.kafka_password,
        })
    else:
        config["security.protocol"] = "PLAINTEXT"
    return config


class KafkaService:
    """Non-blocking producer; flush is reserved for process shutdown."""

    def __init__(
        self,
        producer: ProducerLike | None = None,
        *,
        ensure_topics: bool = True,
        profile: str | None = None,
    ) -> None:
        if producer is None:
            if not KAFKA_AVAILABLE:
                raise ImportError("confluent-kafka is not installed")
            producer = Producer(producer_config())
        self.producer = producer
        self.profile = profile or settings.pipeline_profile
        self._pending: set[str] = set()
        self._lock = threading.Lock()
        if ensure_topics and KAFKA_AVAILABLE:
            self._ensure_topics()

    def _admin_config(self) -> dict[str, Any]:
        config = producer_config()
        return {
            key: value
            for key, value in config.items()
            if key in {
                "bootstrap.servers",
                "security.protocol",
                "sasl.mechanisms",
                "sasl.username",
                "sasl.password",
            }
        }

    def _ensure_topics(self) -> None:
        try:
            admin = AdminClient(self._admin_config())
            metadata = admin.list_topics(timeout=10)
            definitions = {
                settings.kafka_alert_topic: settings.kafka_alert_partitions,
                settings.kafka_event_topic: settings.kafka_event_partitions,
                settings.kafka_audit_topic: settings.kafka_audit_partitions,
                settings.kafka_shared_topic: settings.kafka_shared_partitions,
                settings.kafka_alert_dlq_topic: settings.kafka_alert_partitions,
                settings.kafka_event_dlq_topic: settings.kafka_event_partitions,
            }
            missing = [
                NewTopic(
                    name,
                    num_partitions=partitions,
                    replication_factor=settings.kafka_replication_factor,
                )
                for name, partitions in definitions.items()
                if name not in metadata.topics
            ]
            if missing:
                futures = admin.create_topics(missing)
                for topic_name, future in futures.items():
                    future.result(timeout=15)
                    logger.info("Created Kafka topic %s", topic_name)
            expansions = [NewPartitions(name, count) for name, count in definitions.items()
                          if name in metadata.topics and len(metadata.topics[name].partitions) < count]
            if expansions:
                for future in admin.create_partitions(expansions).values():
                    future.result(timeout=15)
        except Exception as exc:
            logger.warning("Kafka topic bootstrap deferred: %s", exc)

    def publish(self, envelope: EventEnvelope, on_delivery=None) -> bool:
        topic = topic_for(envelope, profile=self.profile)
        key = f"{envelope.organization_id}:{envelope.aggregate_id}"
        payload = envelope.model_dump_json().encode("utf-8")
        try:
            with self._lock:
                self._pending.add(envelope.event_id)
            self.producer.produce(
                topic=topic,
                key=key.encode("utf-8"),
                value=payload,
                headers={
                    "event_type": envelope.event_type,
                    "priority": envelope.priority.value,
                    "schema_version": str(envelope.schema_version),
                },
                on_delivery=lambda error, message: self._delivery_callback(envelope.event_id, error, message, on_delivery),
            )
            self.producer.poll(0)
            return True
        except BufferError:
            self.producer.poll(0.1)
            logger.warning("Kafka queue full for event %s", envelope.event_id)
            with self._lock:
                self._pending.discard(envelope.event_id)
            return False
        except Exception as exc:
            logger.error("Kafka publish failed for %s: %s", envelope.event_id, exc)
            with self._lock:
                self._pending.discard(envelope.event_id)
            return False

    def _delivery_callback(self, event_id: str, error: Any, message: Any, callback=None) -> None:
        with self._lock:
            self._pending.discard(event_id)
        if callback:
            callback(error is None)
        if error:
            logger.error("Kafka delivery failed for %s: %s", event_id, error)
        else:
            logger.debug(
                "Delivered %s to %s[%s]@%s",
                event_id,
                message.topic(),
                message.partition(),
                message.offset(),
            )

    def produce_shift_event(self, event: ShiftEvent) -> bool:
        occurred_at = event.event_time
        if occurred_at.tzinfo is None:
            occurred_at = occurred_at.replace(tzinfo=timezone.utc)
        priority = (
            EventPriority.HIGH
            if event.event_type.value.startswith("ALERT_")
            else EventPriority.NORMAL
        )
        envelope = EventEnvelope(
            event_id=event.event_id or str(uuid.uuid4()),
            organization_id=current_organization_id() or settings.default_organization_id,
            source="aegis-api",
            event_type=f"shift.{event.event_type.value.lower()}",
            priority=priority,
            topic_class="alert" if priority in {EventPriority.HIGH, EventPriority.CRITICAL} else "bulk",
            occurred_at=occurred_at,
            aggregate_type="shift",
            aggregate_id=event.shift_id,
            payload={
                "shift_id": event.shift_id,
                "employee_id": event.employee_id,
                **(event.payload or {}),
            },
        )
        return self.publish(envelope)

    def flush(self, timeout: float = 10) -> int:
        return self.producer.flush(timeout=timeout)

    def publish_confirmed(self, envelopes: list[EventEnvelope], timeout: float = 5) -> set[str]:
        """Queue a batch, then await broker acknowledgments without per-event flushes."""
        delivered: dict[str, bool | None] = {event.event_id: None for event in envelopes}
        for envelope in envelopes:
            key = envelope.event_id
            accepted = self.publish(envelope, on_delivery=lambda ok, key=key: delivered.__setitem__(key, ok))
            if not accepted:
                delivered[key] = False
        deadline = time.monotonic() + timeout
        while any(value is None for value in delivered.values()) and time.monotonic() < deadline:
            self.producer.poll(0.01)
        return {key for key, success in delivered.items() if success is True}

    @property
    def pending_count(self) -> int:
        with self._lock:
            return len(self._pending)


class MockKafkaService:
    """Visible fallback that retains events for tests and local inspection."""

    def __init__(self, profile: str | None = None) -> None:
        self.profile = profile or settings.pipeline_profile
        self.published: list[tuple[str, EventEnvelope | ShiftEvent]] = []

    def publish(self, envelope: EventEnvelope) -> bool:
        self.published.append((topic_for(envelope, profile=self.profile), envelope))
        logger.info("[MOCK] Kafka %s -> %s", envelope.event_type, self.published[-1][0])
        return True

    def produce_shift_event(self, event: ShiftEvent) -> bool:
        self.published.append((settings.kafka_event_topic, event))
        logger.info("[MOCK] Kafka shift event %s", event.event_type)
        return True

    def flush(self, timeout: float = 10) -> int:
        return 0


kafka_service: KafkaService | MockKafkaService | None = None


def get_kafka_service() -> KafkaService | MockKafkaService:
    global kafka_service
    if kafka_service is not None:
        return kafka_service
    if not KAFKA_AVAILABLE or settings.kafka_bootstrap_servers == "placeholder":
        kafka_service = MockKafkaService()
        return kafka_service
    try:
        kafka_service = KafkaService()
    except Exception as exc:
        logger.warning("Kafka unavailable; using explicit mock fallback: %s", exc)
        kafka_service = MockKafkaService()
    return kafka_service


def close_kafka_service() -> None:
    if kafka_service is not None:
        kafka_service.flush(timeout=10)
