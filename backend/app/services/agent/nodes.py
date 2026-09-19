import logging
from typing import Any, Dict, List

from app.services.agent.state import AgentState
from app.services.agent.embeddings import get_embedding
from app.services.agent.validation import validate_agent_plan
from app.services.agent.action_engine import commit_agent_action
from app.services.agent.plan import build_resolution_plan
from app.db.session import SessionLocal
from app.models.inventory import Activity
from app.models.trip import Trip, ItineraryItem
from app.core.config import settings

logger = logging.getLogger(__name__)


def _activity_map(db, component_ids: List[str]) -> Dict[str, Activity]:
    if not component_ids:
        return {}
    rows = db.query(Activity).filter(Activity.id.in_(component_ids)).all()
    return {str(row.id): row for row in rows}


def retrieve_context(state: AgentState) -> Dict[str, Any]:
    """Fetches the active trip and its itinerary from the database."""
    logger.info("Retrieving context for event: %s", state.get("event_id"))
    payload = state.get("payload", {}) or {}
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
                    "trip_id": None,
                    "current_itinerary": [],
                    "constraints": {"preserve_budget": True, "max_extra_cost": 50},
                    "destination_id": None,
                    "status": "CONTEXT_RETRIEVED",
                }

            items: List[ItineraryItem] = (
                db.query(ItineraryItem)
                .filter(ItineraryItem.trip_id == trip.id)
                .order_by(ItineraryItem.day_number)
                .all()
            )
            activities = _activity_map(db, [str(item.component_id) for item in items])
            itinerary_summary = []
            destination_id = None
            for item in items:
                activity = activities.get(str(item.component_id))
                if activity and destination_id is None:
                    destination_id = str(activity.destination_id)
                itinerary_summary.append(
                    {
                        "item_id": str(item.id),
                        "day": item.day_number,
                        "component_type": item.component_type,
                        "component_id": str(item.component_id),
                        "status": item.status,
                        "name": activity.name if activity else None,
                        "price": float(activity.base_price) if activity else 0.0,
                        "description": activity.description if activity else None,
                        "constraints": item.agent_constraints or {},
                    }
                )
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
                "destination_id": destination_id,
                "status": "CONTEXT_RETRIEVED",
            }
    except Exception as e:
        logger.error("Failed to retrieve trip context: %s", e)
        return {
            "trip_id": None,
            "current_itinerary": [],
            "constraints": {"preserve_budget": True, "max_extra_cost": 50},
            "destination_id": None,
            "status": "CONTEXT_RETRIEVED",
        }


def search_alternatives(state: AgentState) -> Dict[str, Any]:
    """Semantic search via pgvector cosine distance, with keyword fallback."""
    payload = state.get("payload", {}) or {}
    itinerary = state.get("current_itinerary") or []
    disrupted = (
        payload.get("attraction")
        or payload.get("activity")
        or payload.get("guide")
        or ""
    )
    query_text = " ".join(
        part for part in (disrupted, str(payload.get("reason", "")), " ".join(
            f"{i.get('name', '')} {i.get('description', '')}" for i in itinerary[:3]
        )) if part
    ).strip() or "travel activity alternative"
    logger.info("Searching alternatives using vector search...")
    query_embedding = get_embedding(query_text)
    destination_id = state.get("destination_id")
    occupied_ids = {str(i.get("component_id")) for i in itinerary}

    try:
        with SessionLocal() as db:
            results = []
            query = db.query(Activity).filter(Activity.embedding.isnot(None))
            if destination_id:
                query = query.filter(Activity.destination_id == destination_id)
            try:
                rows = query.order_by(Activity.embedding.cosine_distance(query_embedding)).limit(8).all()
                results = [row for row in rows if str(row.id) not in occupied_ids][:3]
                logger.info("pgvector search returned %d unused candidates.", len(results))
            except Exception as vec_err:
                logger.warning("pgvector search failed (%s). Falling back to keyword search.", vec_err)

            if not results:
                keyword = disrupted or ""
                fallback = db.query(Activity)
                if destination_id:
                    fallback = fallback.filter(Activity.destination_id == destination_id)
                if keyword:
                    fallback = fallback.filter(
                        Activity.name.ilike(f"%{keyword}%")
                        | Activity.description.ilike(f"%{keyword}%")
                    )
                rows = fallback.limit(8).all()
                results = [row for row in rows if str(row.id) not in occupied_ids][:3]
                if not results:
                    results = [row for row in db.query(Activity).limit(8).all() if str(row.id) not in occupied_ids][:3]
                logger.info("Keyword/fallback returned %d candidates.", len(results))

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
    """Propose a structured itinerary replacement using LLM JSON, with a deterministic fallback."""
    logger.info("Planning resolution...")
    itinerary = state.get("current_itinerary") or []
    search_results = state.get("search_results") or []
    payload = state.get("payload") or {}
    llm_content = None

    if settings.OPENAI_API_KEY:
        try:
            from langchain_openai import ChatOpenAI

            llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.OPENAI_API_KEY)
            prompt = f"""You are an AI travel agent. A disruption has occurred on a planned trip.
Return ONLY valid JSON with this shape:
{{
  "replace": {{"old": "<exact current itinerary item name>", "new": "<exact alternative name from the list>"}},
  "new_cost": <numeric extra cost vs the old item>,
  "reasoning_summary": "<one sentence for the traveller>"
}}

Disruption Event: {payload}
Current Itinerary: {itinerary}
Available Alternatives: {search_results}
Constraints: {state.get('constraints')}
"""
            response = llm.invoke(prompt)
            llm_content = getattr(response, "content", None) or str(response)
        except Exception as e:
            logger.error("LLM planning failed: %s", e)

    proposed, summary = build_resolution_plan(itinerary, search_results, payload, llm_content)
    if not proposed:
        return {
            "proposed_changes": {},
            "reasoning_summary": summary,
            "status": "PLAN_FAILED",
        }
    return {
        "proposed_changes": proposed,
        "reasoning_summary": summary,
        "status": "PLAN_PROPOSED",
    }


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
    """Writes the audit log, applies itinerary replacement, and publishes the SSE event."""
    commit_agent_action(state)
    return {"status": "COMPLETED"}
