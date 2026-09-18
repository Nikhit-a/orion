import logging
from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="run_agent_workflow")
def run_agent_workflow(event_data: dict):
    """
    Celery task: invokes the full LangGraph agent pipeline for a disruption event.
    """
    logger.info("Running agent workflow for event: %s", event_data.get("event_id"))

    from app.services.agent.graph import agent_graph

    initial_state = {
        "event_id": event_data.get("event_id"),
        "event_type": event_data.get("event_type"),
        "payload": event_data.get("payload", {}),
    }

    result = agent_graph.invoke(initial_state)
    logger.info(
        "Agent workflow complete — status=%s summary=%s",
        result.get("status"),
        result.get("reasoning_summary"),
    )
    return result
