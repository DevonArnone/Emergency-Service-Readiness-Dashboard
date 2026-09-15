"""Consume one Kafka traffic class and fan it to every API node through Redis."""

from __future__ import annotations

import argparse
import logging
import signal
import time

try:
    from confluent_kafka import Consumer, KafkaError, Producer, TopicPartition
except ImportError:  # pragma: no cover
    Consumer = None
    KafkaError = None

from redis import Redis

from app.config import settings
from app.models import EventEnvelope
from app.services.kafka_service import KafkaService, producer_config
from pydantic import ValidationError


logger = logging.getLogger(__name__)
running = True


STREAM_TOPICS = {
    "alerts": lambda: settings.kafka_alert_topic,
    "bulk": lambda: settings.kafka_event_topic,
    "audit": lambda: settings.kafka_audit_topic,
    "shared": lambda: settings.kafka_shared_topic,
}


def stop(*_args) -> None:
    global running
    running = False


def consumer_config(stream: str) -> dict:
    producer = producer_config()
    config = {
        key: value
        for key, value in producer.items()
        if key in {
            "bootstrap.servers",
            "security.protocol",
            "sasl.mechanisms",
            "sasl.username",
            "sasl.password",
        }
    }
    config.update({
        "group.id": f"aegis-realtime-{stream}-v1",
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
        "enable.auto.offset.store": False,
        "max.poll.interval.ms": 300000,
    })
    return config


def forward_message(consumer, redis, producer, message, stream: str) -> bool:
    """Never advance past an event that has not reached Redis or the quarantine topic."""
    try:
        try:
            envelope = EventEnvelope.model_validate_json(message.value())
        except ValidationError:
            topic = settings.kafka_alert_dlq_topic if stream == 'alerts' else settings.kafka_event_dlq_topic
            result = []
            producer.produce(topic=topic, key=message.key(), value=message.value(),
                headers={'source_topic': message.topic(), 'reason': 'invalid_event_contract'},
                on_delivery=lambda error, _: result.append(error is None))
            deadline = time.monotonic() + 5
            while not result and time.monotonic() < deadline:
                producer.poll(0.01)
            if result != [True]:
                raise RuntimeError('Quarantine delivery unconfirmed')
        else:
            redis.publish(f'aegis:{envelope.organization_id}:operations', envelope.model_dump_json())
        offsets = consumer.commit(message=message, asynchronous=False)
        if any(offset.error for offset in offsets or []):
            raise RuntimeError('Offset commit failed')
        return True
    except Exception:
        logger.exception('Bridge delivery failed; retrying the same broker offset')
        consumer.seek(TopicPartition(message.topic(), message.partition(), message.offset()))
        return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stream", choices=sorted(STREAM_TOPICS), required=True)
    args = parser.parse_args()
    if Consumer is None:
        raise RuntimeError("confluent-kafka is required for the realtime bridge")
    logging.basicConfig(level=logging.INFO)
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    topic = STREAM_TOPICS[args.stream]()
    consumer = Consumer(consumer_config(args.stream))
    producer = KafkaService().producer
    redis = Redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2)
    consumer.subscribe([topic])
    logger.info("Realtime bridge subscribed to %s", topic)
    try:
        while running:
            message = consumer.poll(0.5)
            if message is None:
                continue
            if message.error():
                if message.error().code() != KafkaError._PARTITION_EOF:
                    logger.error("Kafka consumer error: %s", message.error())
                continue
            if not forward_message(consumer, redis, producer, message, args.stream):
                time.sleep(0.1)
    finally:
        consumer.close()
        producer.flush(5)
        redis.close()


if __name__ == "__main__":
    main()
