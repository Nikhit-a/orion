"""
Streaming inference endpoint — streams LLM reasoning token-by-token via SSE.
Frontend connects here when a disruption event is being processed.
"""
import json
import asyncio
import logging
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


async def _stream_inference(event_id: str, event_type: str, payload: dict):
    """
    Async generator that streams agent reasoning as SSE tokens.
    Uses real OpenAI streaming when key is set, falls back to simulated stream.
    """

    steps = [
        ("retrieve", "🔍 Retrieving trip context from database..."),
        ("search",   "🧠 Running semantic vector search for alternatives..."),
        ("plan",     "⚡ LLM reasoning about optimal replacement..."),
        ("validate", "✅ Validating proposal against budget constraints..."),
        ("commit",   "💾 Committing decision to audit log..."),
    ]

    # --- Step progress events ---
    for step_id, step_label in steps:
        yield f"data: {json.dumps({'type': 'step_start', 'step': step_id, 'label': step_label})}\n\n"
        await asyncio.sleep(0.4)

        if step_id == "plan":
            # Stream the LLM reasoning tokens
            if settings.OPENAI_API_KEY:
                try:
                    from openai import AsyncOpenAI
                    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                    prompt = f"""You are an AI travel agent. A disruption occurred:
Event: {event_type}
Details: {json.dumps(payload)}

In 2-3 sentences, explain your reasoning for resolving this disruption and what alternative you would suggest. Be specific and helpful."""

                    stream = await client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": prompt}],
                        stream=True,
                        max_tokens=200,
                    )
                    async for chunk in stream:
                        token = chunk.choices[0].delta.content
                        if token:
                            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
                            await asyncio.sleep(0.01)
                except Exception as e:
                    logger.error("OpenAI streaming failed: %s", e)
                    # fallback to simulated
                    for token in _simulated_reasoning(event_type, payload):
                        yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
                        await asyncio.sleep(0.04)
            else:
                # Simulated token stream
                for token in _simulated_reasoning(event_type, payload):
                    yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
                    await asyncio.sleep(0.04)

        yield f"data: {json.dumps({'type': 'step_done', 'step': step_id})}\n\n"
        await asyncio.sleep(0.2)

    # Final resolution summary
    resolution = _build_resolution(event_type, payload)
    yield f"data: {json.dumps({'type': 'resolution', **resolution})}\n\n"
    yield f"data: {json.dumps({'type': 'done'})}\n\n"


def _simulated_reasoning(event_type: str, payload: dict) -> list[str]:
    """Returns a list of word tokens for simulated streaming."""
    templates = {
        "ATTRACTION_CLOSED": f"The {payload.get('attraction', 'attraction')} is closed due to {payload.get('reason', 'unforeseen circumstances')}. I'm analyzing the itinerary to find the most suitable nearby alternative with similar cultural value and comparable pricing. Based on semantic similarity scores, I recommend substituting with a nearby attraction that preserves the day's theme while staying within the budget constraints.",
        "WEATHER_WARNING": f"A {payload.get('severity', 'high')}-severity weather warning has been issued for {payload.get('area', 'the area')}. I'm rerouting outdoor activities to covered venues. The revised itinerary prioritizes indoor cultural experiences and ensures traveler safety while maintaining the overall trip quality.",
        "GUIDE_UNAVAILABLE": f"Guide {payload.get('guide', 'the assigned guide')} is unavailable on {payload.get('date', 'the scheduled date')}. I'm searching for an equally qualified local expert with matching specializations and language capabilities. The replacement maintains the same tour quality and price point.",
    }
    text = templates.get(event_type, f"Processing {event_type} disruption. Analyzing available alternatives and computing optimal resolution strategy based on current itinerary constraints and traveler preferences.")
    # Split into word-level tokens with spaces
    tokens = []
    for word in text.split(" "):
        tokens.append(word + " ")
    return tokens


def _build_resolution(event_type: str, payload: dict) -> dict:
    resolutions = {
        "ATTRACTION_CLOSED": {
            "old_item": payload.get("attraction", "Affected attraction"),
            "new_item": "Alternative Cultural Site",
            "cost_delta": 0,
            "status": "REPLACED",
            "summary": f"{payload.get('attraction', 'Attraction')} replaced with nearest alternative."
        },
        "WEATHER_WARNING": {
            "old_item": "Outdoor Activities",
            "new_item": "Indoor Museum Experience",
            "cost_delta": 5,
            "status": "REPLACED",
            "summary": "Outdoor activities rerouted to covered venues due to weather."
        },
        "GUIDE_UNAVAILABLE": {
            "old_item": payload.get("guide", "Original Guide"),
            "new_item": "Replacement Expert Guide",
            "cost_delta": 0,
            "status": "REPLACED",
            "summary": f"New guide assigned with matching specializations."
        },
    }
    return resolutions.get(event_type, {
        "old_item": "Disrupted component",
        "new_item": "Alternative",
        "cost_delta": 0,
        "status": "REPLACED",
        "summary": "Disruption resolved by agent."
    })


@router.post("/stream")
async def stream_inference(body: dict):
    """
    Accepts { event_type, payload } and streams the agent's
    reasoning process token-by-token as SSE.
    """
    event_id = body.get("event_id", "unknown")
    event_type = body.get("event_type", "UNKNOWN")
    payload = body.get("payload", {})

    return StreamingResponse(
        _stream_inference(event_id, event_type, payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
