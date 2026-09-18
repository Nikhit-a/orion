import logging
import asyncio
from typing import Any, Dict
from app.db.session import SessionLocal
from app.models.agent import AgentAction

logger = logging.getLogger(__name__)


def commit_agent_action(state: Dict[str, Any]):
    """
    Records the agent's decision into the AgentAction audit log table and
    publishes a live update via Redis PubSub for the SSE endpoint.
    """
    logger.info("Committing agent action to the database...")

    validation_result = state.get("validation_result", {})
    is_valid = validation_result.get("is_valid", False)
    action_status = "VALIDATED" if is_valid else "REJECTED"
    trip_id = state.get("trip_id", "00000000-0000-0000-0000-000000000000")

    try:
        with SessionLocal() as db:
            action = AgentAction(
                event_id=state.get("event_id"),
                trip_id=trip_id,
                reasoning_summary=state.get("reasoning_summary"),
                proposed_changes=state.get("proposed_changes", {}),
                validation_result=validation_result,
                status=action_status,
            )
            db.add(action)
            db.commit()
            db.refresh(action)
            logger.info("Recorded AgentAction id=%s status=%s", action.id, action_status)

            sse_payload = {
                "type": "agent_action",
                "action_id": str(action.id),
                "status": action_status,
                "reasoning_summary": state.get("reasoning_summary", ""),
                "proposed_changes": state.get("proposed_changes", {}),
                "validation_errors": validation_result.get("errors", []),
            }
            _publish_sync(trip_id, sse_payload)

    except Exception as e:
        logger.error("Failed to commit agent action: %s", e)


def _publish_sync(trip_id: str, payload: dict):
    """Runs the async Redis publish in a new event loop (safe from sync Celery tasks)."""
    try:
        from app.services.sse.redis_pubsub import publish_agent_event
        loop = asyncio.new_event_loop()
        loop.run_until_complete(publish_agent_event(trip_id, payload))
        loop.close()
    except Exception as e:
        logger.error("Failed to publish SSE event: %s", e)
