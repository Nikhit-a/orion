from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.agent import AgentEvent
from app.services.kafka.producer import kafka_producer

router = APIRouter()


class EventSimulationRequest(BaseModel):
    event_type: str = Field(..., examples=["ATTRACTION_CLOSED"])
    payload: Dict[str, Any] = Field(
        default_factory=dict,
        examples=[{"attraction": "Kinkaku-ji Temple Visit", "reason": "Strike", "trip_id": None}],
    )
    trip_id: Optional[str] = None


def _dispatch_agent(event_data: dict) -> str:
    """Publish to Kafka when live; otherwise run the agent graph inline."""
    kafka_producer.send_event(topic="agent-events", event_data=event_data)
    if getattr(kafka_producer, "is_live", False):
        return "kafka"
    from app.tasks.agent_tasks import run_agent_workflow

    run_agent_workflow(event_data)
    return "inline"


@router.post("/simulate")
def simulate_event(request: EventSimulationRequest, db: Session = Depends(get_db)):
    """Simulates a disruption event, persists it, and dispatches the agent pipeline."""
    payload = dict(request.payload or {})
    if request.trip_id and not payload.get("trip_id"):
        payload["trip_id"] = request.trip_id

    try:
        new_event = AgentEvent(
            event_type=request.event_type,
            payload=payload,
            status="PENDING",
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)

        event_data = {
            "event_id": str(new_event.id),
            "event_type": new_event.event_type,
            "payload": new_event.payload,
        }
        transport = _dispatch_agent(event_data)
        new_event.status = "PROCESSED"
        db.add(new_event)
        db.commit()

        return {
            "status": "success",
            "message": f"Event dispatched via {transport}",
            "event_id": str(new_event.id),
            "transport": transport,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
