"""Inspectable event-pipeline configuration and health."""

from fastapi import APIRouter

from app.config import settings
from app.services.kafka_service import KAFKA_AVAILABLE, get_kafka_service


router = APIRouter(prefix="/api/v1/pipeline", tags=["pipeline"])


@router.get("/status")
async def pipeline_status() -> dict:
    service = get_kafka_service()
    return {
        "profile": settings.pipeline_profile,
        "transport": "kafka" if KAFKA_AVAILABLE and service.__class__.__name__ == "KafkaService" else "mock",
        "topics": {
            "alerts": {"name": settings.kafka_alert_topic, "partitions": settings.kafka_alert_partitions},
            "events": {"name": settings.kafka_event_topic, "partitions": settings.kafka_event_partitions},
            "audit": {"name": settings.kafka_audit_topic, "partitions": settings.kafka_audit_partitions},
            "shared_baseline": {
                "name": settings.kafka_shared_topic,
                "partitions": settings.kafka_shared_partitions,
            },
        },
        "priority_isolated": settings.pipeline_profile == "optimized",
        "redis_fanout": settings.redis_fanout_enabled,
    }
