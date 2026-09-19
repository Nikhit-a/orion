import json
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class _NoopProducer:
    is_live = False

    def send_event(self, topic: str, event_data: dict):
        logger.info("NOOP Kafka send — topic=%s data=%s", topic, event_data)

    def flush(self):
        pass


try:
    from confluent_kafka import Producer

    _producer_conf = {"bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS}

    def _delivery_report(err, msg):
        if err:
            logger.error("Kafka delivery failed: %s", err)
        else:
            logger.info("Kafka message delivered to %s [%d]", msg.topic(), msg.partition())

    class EventProducer:
        is_live = True

        def __init__(self):
            self._producer = Producer(_producer_conf)

        def send_event(self, topic: str, event_data: dict):
            self._producer.produce(
                topic,
                value=json.dumps(event_data).encode("utf-8"),
                callback=_delivery_report,
            )
            self._producer.poll(0)

        def flush(self):
            self._producer.flush()

    kafka_producer = EventProducer()

except Exception as e:
    logger.warning("Kafka producer unavailable (%s). Events will be processed inline.", e)
    kafka_producer = _NoopProducer()
