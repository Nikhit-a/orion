from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.agent import AgentEvent
from app.services.kafka.producer import kafka_producer

router = APIRouter()


class EventSimulationRequest(BaseModel):
    event_type: str = Field(..., example="ATTRACTION_CLOSED")
    payload: Dict[str, Any] = Field(..., example={"attraction": "Eiffel Tower", "reason": "Strike"})


@router.post("/simulate")
def simulate_event(request: EventSimulationRequest, db: Session = Depends(get_db)):
    """
    Simulates a disruption event, writes it to the database, and emits it to Kafka.
    """
    try:
        new_event = AgentEvent(
            event_type=request.event_type,
            payload=request.payload,
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
        kafka_producer.send_event(topic="agent-events", event_data=event_data)

        return {
            "status": "success",
            "message": "Event simulated and pushed to Kafka",
            "event_id": str(new_event.id),
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
