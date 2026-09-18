import logging
import time
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import router as api_v1_router

# ---------------------------------------------------------------------------
# Structured logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("packagepro")

# Quieten noisy third-party loggers in production
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="PackagePro API",
    description="Backend API for the PackagePro dynamic tour packaging application.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request logging middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log each request with method, path, status code and latency."""
    request_id = str(uuid.uuid4())[:8]
    start = time.perf_counter()
    logger.info(
        "request_start  id=%s  %s %s",
        request_id,
        request.method,
        request.url.path,
    )
    try:
        response = await call_next(request)
    except Exception as exc:
        logger.exception(
            "request_error  id=%s  %s %s  error=%s",
            request_id,
            request.method,
            request.url.path,
            exc,
        )
        raise
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "request_end    id=%s  %s %s  status=%d  duration=%.1fms",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


app.include_router(api_v1_router, prefix="/api/v1")
