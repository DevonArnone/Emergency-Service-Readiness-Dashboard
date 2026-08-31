"""Priority routing and outbox reliability tests."""

from datetime import datetime, timezone
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models import Organization, OutboxEvent
from app.models import EventEnvelope, EventPriority
from app.services.kafka_service import KafkaService, topic_for
from app.services.outbox_service import enqueue_event
from benchmarks.compare_results import compare


class FakeProducer:
    def __init__(self) -> None:
        self.messages = []
        self.poll_calls = []
        self.flush_calls = []

    def produce(self, **kwargs) -> None:
        self.messages.append(kwargs)

    def poll(self, timeout: float) -> int:
        self.poll_calls.append(timeout)
        return 0

    def flush(self, timeout: float | None = None) -> int:
        self.flush_calls.append(timeout)
        return 0


def envelope(event_id: str = "event-1", topic_class: str = "alert") -> EventEnvelope:
    return EventEnvelope(
        event_id=event_id,
        organization_id="org-1",
        source="test",
        event_type="incident.alerted",
        priority=EventPriority.HIGH,
        topic_class=topic_class,
        occurred_at=datetime.now(timezone.utc),
        aggregate_type="incident",
        aggregate_id="incident-1",
        payload={"synthetic": True},
    )


class KafkaRoutingTests(unittest.TestCase):
    def test_priority_and_bulk_topics_are_isolated(self) -> None:
        self.assertNotEqual(topic_for(envelope(topic_class="alert")), topic_for(envelope(topic_class="bulk")))

    def test_baseline_routes_everything_to_shared_topic(self) -> None:
        self.assertEqual(
            topic_for(envelope(topic_class="alert"), profile="baseline"),
            topic_for(envelope(topic_class="bulk"), profile="baseline"),
        )

    def test_publish_does_not_flush_per_message(self) -> None:
        producer = FakeProducer()
        service = KafkaService(producer=producer, ensure_topics=False)
        self.assertTrue(service.publish(envelope()))
        self.assertEqual(len(producer.messages), 1)
        self.assertEqual(producer.poll_calls, [0])
        self.assertEqual(producer.flush_calls, [])


class OutboxTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_enqueue_is_idempotent(self) -> None:
        with Session(self.engine) as session:
            session.add(Organization(organization_id="org-1", slug="org-1", name="Test"))
            session.commit()
            first = enqueue_event(session, envelope())
            second = enqueue_event(session, envelope())
            session.commit()
            self.assertEqual(first.outbox_event_id, second.outbox_event_id)
            self.assertEqual(session.query(OutboxEvent).count(), 1)


class BenchmarkEvidenceTests(unittest.TestCase):
    def test_comparison_gates_requested_targets(self) -> None:
        baseline = {
            "evidence_level": "local_integration",
            "lost": 0,
            "alert_delivery_backlog": {"p95": 10},
        }
        optimized = {
            "evidence_level": "local_integration",
            "lost": 0,
            "alert_delivery_backlog": {"p95": 2},
            "end_to_end_latency_ms": {"p95": 150},
        }
        result = compare(baseline, optimized)
        self.assertTrue(result["claim_eligible"])
        self.assertEqual(result["alert_delivery_backlog_reduction_pct"], 80)


if __name__ == "__main__":
    unittest.main()
