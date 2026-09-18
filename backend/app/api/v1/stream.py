from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.sse.redis_pubsub import subscribe_to_trip

router = APIRouter()


@router.get("/trip/{trip_id}")
async def stream_trip_events(trip_id: str):
    """
    SSE endpoint — streams live agent events for a given trip via Redis PubSub.
    """
    return StreamingResponse(
        subscribe_to_trip(trip_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
