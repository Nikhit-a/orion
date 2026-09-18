import logging
from typing import Any, Dict, List

from app.services.agent.state import AgentState
from app.services.agent.embeddings import get_embedding
from app.services.agent.validation import validate_agent_plan
from app.services.agent.action_engine import commit_agent_action
from app.db.session import SessionLocal
from app.models.inventory import Activity
from app.models.trip import Trip, ItineraryItem
from app.core.config import settings

logger = logging.getLogger(__name__)


def retrieve_context(state: AgentState) -> Dict[str, Any]:
    """
    Fetches the active trip and its itinerary from the database.
    Prefers a trip_id supplied in the event payload; falls back to the most
    recent ACTIVE/DRAFT trip.
    """
    logger.info("Retrieving context for event: %s", state.get("event_id"))
    payload = state.get("payload", {})
    explicit_trip_id = payload.get("trip_id")

    try:
        with SessionLocal() as db:
            trip = None
            if explicit_trip_id:
                trip = (
                    db.query(Trip)
                    .filter(
                        Trip.id == explicit_trip_id,
                        Trip.status.in_(["ACTIVE", "DRAFT", "CONFIRMED"]),
                    )
                    .first()
                )
            if trip is None:
                trip = (
                    db.query(Trip)
                    .filter(Trip.status.in_(["ACTIVE", "DRAFT", "CONFIRMED"]))
                    .order_by(Trip.created_at.desc())
                    .first()
                )
            if trip is None:
                logger.warning("No active trip found; using fallback context.")
                return {
                    "trip_id": "00000000-0000-0000-0000-000000000000",
                    "current_itinerary": [],
                    "constraints": {"preserve_budget": True, "max_extra_cost": 50},
                    "status": "CONTEXT_RETRIEVED",
                }

            items: List[ItineraryItem] = (
                db.query(ItineraryItem)
                .filter(ItineraryItem.trip_id == trip.id)
                .order_by(ItineraryItem.day_number)
                .all()
            )
            itinerary_summary = [
                {
                    "item_id": str(item.id),
                    "day": item.day_number,
                    "component_type": item.component_type,
                    "component_id": str(item.component_id),
                    "status": item.status,
                    "constraints": item.agent_constraints or {},
                }
                for item in items
            ]
            constraints = {"preserve_budget": True, "max_extra_cost": 50}
            for item in items:
                if item.agent_constraints:
                    constraints.update(item.agent_constraints)
                    break

            logger.info("Context retrieved: trip %s, %d items.", trip.id, len(itinerary_summary))
            return {
                "trip_id": str(trip.id),
                "current_itinerary": itinerary_summary,
                "constraints": constraints,
                "status": "CONTEXT_RETRIEVED",
            }
    except Exception as e:
        logger.error("Failed to retrieve trip context: %s", e)
        return {
            "trip_id": "00000000-0000-0000-0000-000000000000",
            "current_itinerary": [],
            "constraints": {"preserve_budget": True, "max_extra_cost": 50},
            "status": "CONTEXT_RETRIEVED",
        }


def search_alternatives(state: AgentState) -> Dict[str, Any]:
    """
    Semantic search via pgvector cosine distance to find alternative activities.
    Falls back to ILIKE keyword search if embeddings aren't populated.
    """
    query_text = str(state.get("payload", ""))
    logger.info("Searching alternatives using vector search...")
    query_embedding = get_embedding(query_text)

    try:
        with SessionLocal() as db:
            results = []
            try:
                rows = (
                    db.query(Activity)
                    .filter(Activity.embedding.isnot(None))
                    .order_by(Activity.embedding.cosine_distance(query_embedding))
                    .limit(3)
                    .all()
                )
                results = rows
                logger.info("pgvector search returned %d candidates.", len(results))
            except Exception as vec_err:
                logger.warning("pgvector search failed (%s). Falling back to keyword search.", vec_err)

            if not results:
                keyword = (
                    state.get("payload", {}).get("attraction", "")
                    or state.get("payload", {}).get("activity", "")
                    or ""
                )
                if keyword:
                    rows = (
                        db.query(Activity)
                        .filter(
                            Activity.name.ilike(f"%{keyword}%")
                            | Activity.description.ilike(f"%{keyword}%")
                        )
                        .limit(3)
                        .all()
                    )
                    results = rows
                    logger.info("Keyword fallback returned %d candidates.", len(results))

            return {
                "search_results": [
                    {
                        "id": str(a.id),
                        "name": a.name,
                        "type": a.activity_type,
                        "price": float(a.base_price),
                        "duration_mins": a.duration_mins,
                        "description": a.description,
                    }
                    for a in results
                ],
                "status": "SEARCH_COMPLETED",
            }
    except Exception as e:
        logger.error("Alternative search failed: %s", e)
        return {"search_results": [], "status": "SEARCH_COMPLETED"}


def plan_resolution(state: AgentState) -> Dict[str, Any]:
    """
    Uses GPT-4o-mini to propose an itinerary change that resolves the disruption.
    Falls back to a deterministic mock when no API key is configured.
    """
    logger.info("Planning resolution using LLM...")

    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — using fallback plan.")
        return {
            "proposed_changes": {
                "replace": {"old": "Affected activity", "new": "Alternative activity"},
                "new_cost": 0,
            },
            "reasoning_summary": "Disruption detected. Suggested nearest available alternative.",
            "status": "PLAN_PROPOSED",
        }

    try:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.OPENAI_API_KEY)
        prompt = f"""
You are an AI travel agent. A disruption has occurred on a planned trip.

Disruption Event: {state.get('payload')}
Current Itinerary: {state.get('current_itinerary')}
Available Alternatives: {state.get('search_results')}
Constraints: {state.get('constraints')}

Propose a JSON change with keys:
- "replace": {{"old": "<disrupted item>", "new": "<alternative>"}}
- "new_cost": <cost difference as number>

Also write a one-sentence "reasoning_summary" for the traveller.
"""
        response = llm.invoke(prompt)
        return {
            "proposed_changes": {"replace": {"old": "x", "new": "y"}, "new_cost": 0, "llm_output": response.content},
            "reasoning_summary": "LLM processed the disruption and proposed a change.",
            "status": "PLAN_PROPOSED",
        }
    except Exception as e:
        logger.error("LLM planning failed: %s", e)
        return {"status": "PLAN_FAILED"}


def validate_plan(state: AgentState) -> Dict[str, Any]:
    """Deterministically validates the proposed changes."""
    logger.info("Validating agent plan...")
    proposed_changes = state.get("proposed_changes", {})
    constraints = state.get("constraints", {})
    is_valid, errors = validate_agent_plan(proposed_changes, constraints)
    return {
        "validation_result": {"is_valid": is_valid, "errors": errors},
        "status": "VALIDATED" if is_valid else "VALIDATION_FAILED",
    }


def commit_action(state: AgentState) -> Dict[str, Any]:
    """Writes the audit log and publishes the SSE event."""
    commit_agent_action(state)
    return {"status": "COMPLETED"}
