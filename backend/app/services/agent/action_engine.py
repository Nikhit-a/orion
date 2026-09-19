import logging
import asyncio
import uuid
from typing import Any, Dict, Optional

from app.db.session import SessionLocal
from app.models.agent import AgentAction
from app.models.inventory import Activity
from app.models.trip import ItineraryItem
from app.services.pricing import PricingEngine

logger = logging.getLogger(__name__)

_DUMMY_TRIP = "00000000-0000-0000-0000-000000000000"


def _as_uuid(value: Any) -> Optional[uuid.UUID]:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def commit_agent_action(state: Dict[str, Any]):
    """
    Records the agent's decision, applies a validated replacement to the
    itinerary, recalculates price, and publishes a live SSE update.
    """
    logger.info("Committing agent action to the database...")

    validation_result = state.get("validation_result", {}) or {}
    is_valid = bool(validation_result.get("is_valid", False))
    trip_id = _as_uuid(state.get("trip_id"))
    event_id = _as_uuid(state.get("event_id"))
    proposed = state.get("proposed_changes", {}) or {}
    itinerary_diff = None
    total_price = None
    action_status = "REJECTED"

    if not trip_id or str(trip_id) == _DUMMY_TRIP or not event_id:
        logger.warning("Skipping commit — missing trip_id or event_id.")
        return

    try:
        with SessionLocal() as db:
            if is_valid:
                itinerary_diff, total_price = _apply_replacement(db, trip_id, proposed)
                action_status = "APPLIED" if itinerary_diff else "VALIDATED"

            action = AgentAction(
                event_id=event_id,
                trip_id=trip_id,
                reasoning_summary=state.get("reasoning_summary"),
                proposed_changes=proposed,
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
                "proposed_changes": proposed,
                "validation_errors": validation_result.get("errors", []),
                "itinerary_diff": itinerary_diff,
                "total_price": total_price,
            }
            _publish_sync(str(trip_id), sse_payload)

    except Exception as e:
        logger.error("Failed to commit agent action: %s", e)


def _apply_replacement(db, trip_id: uuid.UUID, proposed: Dict[str, Any]):
    replace = proposed.get("replace") or {}
    new_component_id = _as_uuid(replace.get("new_component_id"))
    old_item_id = _as_uuid(replace.get("old_item_id"))
    old_name = (replace.get("old") or "").strip()

    item = None
    if old_item_id:
        item = (
            db.query(ItineraryItem)
            .filter(ItineraryItem.id == old_item_id, ItineraryItem.trip_id == trip_id)
            .first()
        )
    if item is None and old_name:
        items = (
            db.query(ItineraryItem)
            .filter(ItineraryItem.trip_id == trip_id, ItineraryItem.status == "PLANNED")
            .all()
        )
        for candidate in items:
            activity = db.query(Activity).filter(Activity.id == candidate.component_id).first()
            if activity and old_name.lower() in activity.name.lower():
                item = candidate
                break

    if item is None or new_component_id is None:
        logger.warning("Could not apply replacement — item or new component missing.")
        return None, None

    new_activity = db.query(Activity).filter(Activity.id == new_component_id).first()
    if new_activity is None:
        logger.warning("Replacement activity %s not found.", new_component_id)
        return None, None

    old_activity = db.query(Activity).filter(Activity.id == item.component_id).first()
    old_name_resolved = old_activity.name if old_activity else old_name
    item.component_id = new_activity.id
    item.component_type = new_activity.activity_type or item.component_type
    item.status = "REPLACED"
    db.add(item)
    db.flush()

    final_price = PricingEngine.recalculate_trip_price(db, trip_id)
    diff = {
        "item_id": str(item.id),
        "old_name": old_name_resolved,
        "new_name": new_activity.name,
        "old_activity_id": str(old_activity.id) if old_activity else None,
        "new_activity_id": str(new_activity.id),
        "new_price": float(new_activity.base_price),
        "cost_delta": float(proposed.get("new_cost") or 0),
        "status": "REPLACED",
        "day": item.day_number,
    }
    return diff, float(final_price)


def _publish_sync(trip_id: str, payload: dict):
    """Runs the async Redis publish in a new event loop (safe from sync Celery tasks)."""
    try:
        from app.services.sse.redis_pubsub import publish_agent_event

        loop = asyncio.new_event_loop()
        loop.run_until_complete(publish_agent_event(trip_id, payload))
        loop.close()
    except Exception as e:
        logger.error("Failed to publish SSE event: %s", e)
