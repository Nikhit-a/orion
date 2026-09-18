from fastapi import APIRouter
from app.api.v1 import discovery, trips, events, stream, inference

router = APIRouter()
router.include_router(discovery.router, prefix="/discovery", tags=["Discovery"])
router.include_router(trips.router, prefix="/trips", tags=["Trips"])
router.include_router(events.router, prefix="/events", tags=["Events"])
router.include_router(stream.router, prefix="/stream", tags=["Stream"])
router.include_router(inference.router, prefix="/inference", tags=["Inference"])
