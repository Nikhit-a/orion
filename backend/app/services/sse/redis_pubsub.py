import logging
import json
import asyncio
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

CHANNEL_PREFIX = "agent:trip:"


async def get_redis() -> aioredis.Redis:
    return await aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def publish_agent_event(trip_id: str, event: dict):
    r = await get_redis()
    channel = f"{CHANNEL_PREFIX}{trip_id}"
    await r.publish(channel, json.dumps(event))
    await r.aclose()
    logger.info("Published agent event to channel: %s", channel)


async def subscribe_to_trip(trip_id: str):
    r = await get_redis()
    pubsub = r.pubsub()
    channel = f"{CHANNEL_PREFIX}{trip_id}"
    await pubsub.subscribe(channel)
    logger.info("SSE client subscribed to: %s", channel)

    try:
        yield f"data: {json.dumps({'type': 'connected', 'trip_id': trip_id})}\n\n"

        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30)
            if message and message["type"] == "message":
                yield f"data: {message['data']}\n\n"
            else:
                yield ": heartbeat\n\n"
            await asyncio.sleep(0.5)
    except asyncio.CancelledError:
        logger.info("SSE client disconnected from: %s", channel)
    finally:
        await pubsub.unsubscribe(channel)
        await r.aclose()
