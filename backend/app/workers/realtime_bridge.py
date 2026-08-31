"""Consume one Kafka traffic class and fan it to every API node through Redis."""

from __future__ import annotations

import argparse
import logging
import signal

try:
    from confluent_kafka import Consumer, KafkaError
except ImportError:  # pragma: no cover
    Consumer = None
    KafkaError = None

from redis import Redis

from app.config import settings
from app.models import EventEnvelope
from app.services.kafka_service import producer_config


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
        "auto.offset.reset": "latest",
        "enable.auto.commit": False,
        "max.poll.interval.ms": 300000,
    })
    return config


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
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
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
            try:
                envelope = EventEnvelope.model_validate_json(message.value())
                channel = f"aegis:{envelope.organization_id}:operations"
                redis.publish(channel, envelope.model_dump_json())
                consumer.commit(message=message, asynchronous=False)
            except Exception as exc:
                logger.exception("Realtime bridge rejected event: %s", exc)
    finally:
        consumer.close()
        redis.close()


if __name__ == "__main__":
    main()
