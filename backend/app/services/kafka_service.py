"""Kafka producer service for shift events."""
import json
import logging
from datetime import datetime
from typing import Optional

try:
    from confluent_kafka import Producer
    from confluent_kafka.admin import AdminClient, NewTopic
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False
    Producer = None
    AdminClient = None
    NewTopic = None

from app.config import settings
from app.models import ShiftEvent

logger = logging.getLogger(__name__)


class KafkaService:
    """Service for producing messages to Kafka."""
    
    def __init__(self):
        """Initialize Kafka producer with Confluent Cloud configuration."""
        if not KAFKA_AVAILABLE:
            raise ImportError("confluent-kafka is not installed. Using mock service.")
        self.producer = Producer({
            'bootstrap.servers': settings.kafka_bootstrap_servers,
            'security.protocol': 'SASL_SSL',
            'sasl.mechanisms': 'PLAIN',
            'sasl.username': settings.kafka_username,
            'sasl.password': settings.kafka_password,
            'acks': 'all',  # Wait for all replicas
            'retries': 3,
        })
        self.topic = settings.kafka_topic
        self._ensure_topic_exists()
    
    def _ensure_topic_exists(self):
        """Ensure the Kafka topic exists (create if it doesn't)."""
        if not KAFKA_AVAILABLE:
            return
        try:
            admin_client = AdminClient({
                'bootstrap.servers': settings.kafka_bootstrap_servers,
                'security.protocol': 'SASL_SSL',
                'sasl.mechanisms': 'PLAIN',
                'sasl.username': settings.kafka_username,
                'sasl.password': settings.kafka_password,
            })
            
            # Check if topic exists
            metadata = admin_client.list_topics(timeout=10)
            if self.topic not in metadata.topics:
                # Create topic
                topic = NewTopic(self.topic, num_partitions=3, replication_factor=3)
                admin_client.create_topics([topic])
                logger.info(f"Created Kafka topic: {self.topic}")
        except Exception as e:
            logger.warning(f"Could not ensure topic exists (may already exist): {e}")
    
    def produce_shift_event(self, event: ShiftEvent) -> bool:
        """
        Produce a shift event to Kafka.
        
        Args:
            event: ShiftEvent to send
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Serialize event to JSON
            event_dict = {
                "event_id": event.event_id,
                "shift_id": event.shift_id,
                "employee_id": event.employee_id,
                "event_type": event.event_type.value,
                "event_time": event.event_time.isoformat(),
                "payload": event.payload or {},
            }
            
            message = json.dumps(event_dict).encode('utf-8')
            
            # Produce message
            self.producer.produce(
                self.topic,
                value=message,
                callback=self._delivery_callback
            )
            
            # Flush to ensure message is sent
            self.producer.flush(timeout=5)
            
            logger.info(f"Produced shift event to Kafka: {event.event_type} for shift {event.shift_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error producing to Kafka: {e}")
            return False
    
    def _delivery_callback(self, err, msg):
        """Callback for message delivery confirmation."""
        if err:
            logger.error(f"Message delivery failed: {err}")
        else:
            logger.debug(f"Message delivered to {msg.topic()} [{msg.partition()}]")


# Global instance
kafka_service: Optional[KafkaService] = None


def get_kafka_service() -> KafkaService:
    """Get or create Kafka service instance."""
    global kafka_service
    if kafka_service is None:
        if not KAFKA_AVAILABLE:
            logger.info("confluent-kafka not available, using mock Kafka service")
            return MockKafkaService()
        try:
            kafka_service = KafkaService()
        except Exception as e:
            logger.warning(f"Failed to initialize Kafka service: {e}, using mock service")
            # Return a mock service that does nothing
            return MockKafkaService()
    return kafka_service


class MockKafkaService:
    """Mock Kafka service for development when Kafka is not available."""
    
    def produce_shift_event(self, event: ShiftEvent) -> bool:
        """Mock produce that just logs."""
        logger.info(f"[MOCK] Would produce event to Kafka: {event.event_type}")
        return True

