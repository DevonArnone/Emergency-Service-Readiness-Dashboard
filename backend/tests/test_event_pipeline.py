"""Priority routing and outbox reliability tests."""

from datetime import datetime, timezone
import unittest
from unittest.mock import Mock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.db.models import Organization, OutboxEvent
from app.models import EventEnvelope, EventPriority
from app.services.kafka_service import KafkaService, topic_for
from app.services.outbox_service import enqueue_event
from benchmarks.compare_results import compare


class FakeProducer:
    def __init__(self, acknowledgment: bool | None = None) -> None:
        self.messages = []
        self.poll_calls = []
        self.flush_calls = []
        self.acknowledgment = acknowledgment
        self.pending = []

    def produce(self, **kwargs) -> None:
        self.messages.append(kwargs)
        self.pending.append(kwargs)

    def poll(self, timeout: float) -> int:
        self.poll_calls.append(timeout)
        if self.acknowledgment is not None:
            while self.pending:
                message = self.pending.pop(0)
                message['on_delivery'](None if self.acknowledgment else 'delivery failed', Mock())
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
    def test_confirmation_requires_broker_acknowledgment(self) -> None:
        for ack, expected in [(True, {'event-1'}), (False, set()), (None, set())]:
            producer = FakeProducer(ack)
            service = KafkaService(producer=producer, ensure_topics=False)
            self.assertEqual(service.publish_confirmed([envelope()], timeout=0), expected)
            self.assertEqual(producer.flush_calls, [])

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

    def test_event_identifiers_are_namespaced_by_tenant(self) -> None:
        with Session(self.engine) as session:
            session.add_all([Organization(organization_id=org, slug=org, name=org) for org in ['org-1', 'org-2']])
            session.commit()
            first = enqueue_event(session, envelope())
            second = enqueue_event(session, envelope().model_copy(update={'organization_id': 'org-2'}))
            session.commit()
            self.assertNotEqual(first.outbox_event_id, second.outbox_event_id)

    def test_worker_leaves_unconfirmed_events_pending(self) -> None:
        from app.workers.outbox import publish_batch
        factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        with factory() as session:
            session.add(Organization(organization_id='org-1', slug='org-1', name='Test'))
            session.commit()
            record_id = enqueue_event(session, envelope()).outbox_event_id
            session.commit()
        service = KafkaService(producer=FakeProducer(False), ensure_topics=False)
        with patch('app.db.session.SessionLocal', factory), patch('app.workers.outbox.get_kafka_service', return_value=service):
            self.assertEqual(publish_batch(), 0)
        with factory() as session:
            record = session.get(OutboxEvent, record_id)
            self.assertIsNone(record.published_at)
            self.assertEqual(record.attempts, 1)


class BridgeReliabilityTests(unittest.TestCase):
    def test_redis_failure_retries_without_committing(self):
        from app.workers.realtime_bridge import forward_message
        message = Mock()
        message.value.return_value = envelope().model_dump_json().encode()
        message.topic.return_value = 'ops.alerts.v1'
        message.partition.return_value = 0
        message.offset.return_value = 12
        consumer, redis = Mock(), Mock()
        redis.publish.side_effect = ConnectionError('test outage')
        with patch('app.workers.realtime_bridge.TopicPartition', create=True) as partition:
            self.assertFalse(forward_message(consumer, redis, FakeProducer(), message, 'alerts'))
            consumer.commit.assert_not_called()
            partition.assert_called_once_with('ops.alerts.v1', 0, 12)
            consumer.seek.assert_called_once()

    def test_invalid_message_is_quarantined_before_commit(self):
        from app.workers.realtime_bridge import forward_message
        message, consumer, redis = Mock(), Mock(), Mock()
        message.value.return_value = b'{"invalid":true}'
        consumer.commit.return_value = []
        producer = FakeProducer(True)
        self.assertTrue(forward_message(consumer, redis, producer, message, 'alerts'))
        self.assertTrue(producer.messages[0]['topic'].endswith('.dlq.v1'))
        redis.publish.assert_not_called()
        consumer.commit.assert_called_once()


class BenchmarkEvidenceTests(unittest.TestCase):
    def test_comparison_gates_requested_targets(self) -> None:
        baseline = {
            "profile": "baseline", "workload": {"events": 100, "rate_per_second": 100}, "accepted": 100, "delivered": 100,
            "resource_profile": "test-resources", "accepted_per_second": 100,
            "pipeline": {"transport": "kafka", "redis_fanout": True},
            "evidence_level": "local_integration",
            "lost": 0,
            "alert_delivery_backlog": {"p95": 10},
        }
        optimized = {
            "profile": "optimized", "workload": {"events": 100, "rate_per_second": 100}, "accepted": 100, "delivered": 100,
            "resource_profile": "test-resources", "accepted_per_second": 100,
            "pipeline": {"transport": "kafka", "redis_fanout": True},
            "evidence_level": "local_integration",
            "lost": 0,
            "alert_delivery_backlog": {"p95": 2},
            "end_to_end_latency_ms": {"p95": 150},
        }
        result = compare(baseline, optimized)
        self.assertTrue(result["claim_eligible"])
        self.assertEqual(result["alert_delivery_backlog_reduction_pct"], 80)
        self.assertFalse(result['original_consumer_lag_claim_eligible'])
        optimized['sender_errors'] = ['failed HTTP request']
        self.assertFalse(compare(baseline, optimized)['claim_eligible'])
        optimized['sender_errors'] = []
        optimized['accepted_per_second'] = 50
        self.assertFalse(compare(baseline, optimized)['claim_eligible'])
        optimized['accepted_per_second'] = 100
        optimized['resource_profile'] = 'different-resources'
        self.assertFalse(compare(baseline, optimized)['claim_eligible'])


if __name__ == "__main__":
    unittest.main()
