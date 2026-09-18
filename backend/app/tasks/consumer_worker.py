"""
Kafka consumer — polls the agent-events topic and dispatches Celery tasks.
Run with: python -m app.tasks.consumer_worker
"""
import json
import logging
import sys
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    try:
        from confluent_kafka import Consumer, KafkaException, KafkaError
    except ImportError:
        logger.error("confluent-kafka is not installed.")
        sys.exit(1)

    consumer = Consumer(
        {
            "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "group.id": "packagepro-agent-group",
            "auto.offset.reset": "earliest",
        }
    )
    consumer.subscribe(["agent-events"])
    logger.info("Kafka consumer listening on agent-events...")

    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                raise KafkaException(msg.error())

            try:
                event_data = json.loads(msg.value().decode("utf-8"))
                logger.info("Received event: %s", event_data.get("event_id"))
                from app.tasks.agent_tasks import run_agent_workflow
                run_agent_workflow.delay(event_data)
            except Exception as e:
                logger.error("Failed to process Kafka message: %s", e)
    except KeyboardInterrupt:
        pass
    finally:
        consumer.close()


if __name__ == "__main__":
    main()
