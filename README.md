# PackagePro

**PackagePro** is an AI-powered travel packaging platform that builds dynamic itineraries and autonomously resolves disruptions in real time. It was designed as a full-stack portfolio project demonstrating agentic AI, event-driven architecture, and reactive UI patterns.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js 16 / React 19)                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────────┐   │
│  │ Landing Page│  │ Destination  │  │ Agent Activity Feed (SSE) │   │
│  │ (Dest. Grid)│  │ [id] — Build │  │ + Simulate Event Panel    │   │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬───────────────┘   │
│         │  TanStack Query │                      │ EventSource       │
└─────────┼─────────────────┼──────────────────────┼───────────────────┘
          │  REST (JSON)    │                      │ text/event-stream
┌─────────▼─────────────────▼──────────────────────▼───────────────────┐
│  FastAPI (Uvicorn)  :8000                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ /discovery  │  │ /trips       │  │ /events  │  │ /stream      │  │
│  │ destinations│  │ POST, GET    │  │ /simulate│  │ /trip/{id}   │  │
│  │ guides      │  │ PricingEngine│  │          │  │ SSE endpoint │  │
│  │ activities  │  │ Availability │  │          │  │              │  │
│  └──────┬──────┘  └──────┬───────┘  └────┬─────┘  └──────┬───────┘  │
└─────────┼─────────────────┼───────────────┼────────────────┼──────────┘
          │                 │               │                │
          │  SQLAlchemy     │  Kafka Produce│        Redis Subscribe
┌─────────▼─────────────────▼───────────────▼────────────────▼──────────┐
│  Infrastructure (Docker Compose)                                       │
│                                                                        │
│  ┌──────────────────┐   ┌───────────┐   ┌─────────────────────────┐  │
│  │ Postgres+pgvector│   │  Kafka    │   │  Redis 7                │  │
│  │ :5432            │   │  :9092    │   │  :6379                  │  │
│  │ (trips, agents,  │   │  topic:   │   │  channel: agent:trip:*  │  │
│  │  activities, etc)│   │  agent-   │   │  (pubsub for SSE)       │  │
│  └──────────────────┘   │  events   │   └─────────────────────────┘  │
│                          └─────┬─────┘                                │
│                                │ consume                              │
│  ┌─────────────────────────────▼────────────────────────────────────┐ │
│  │  Kafka Consumer Worker (python -m app.tasks.consumer_worker)     │ │
│  │  Polls agent-events topic → dispatches Celery task               │ │
│  └─────────────────────────────┬────────────────────────────────────┘ │
│                                │ .delay()                             │
│  ┌─────────────────────────────▼────────────────────────────────────┐ │
│  │  Celery Worker (celery -A app.core.celery_app worker)            │ │
│  │  Runs run_agent_workflow task → invokes LangGraph agent graph    │ │
│  └─────────────────────────────┬────────────────────────────────────┘ │
└──────────────────────────────── ┼ ──────────────────────────────────────┘
                                  │
             ┌────────────────────▼────────────────────┐
             │  LangGraph Agent Pipeline                │
             │                                          │
             │  retrieve_context                        │
             │       ↓  (DB: find active trip)          │
             │  search_alternatives                     │
             │       ↓  (pgvector cosine search)        │
             │  plan_resolution                         │
             │       ↓  (GPT-4o-mini prompt)            │
             │  validate_plan                           │
             │       ↓  (deterministic rule engine)     │
             │  commit_action                           │
             │       ↓  (DB write + Redis publish)      │
             └──────────────────────────────────────────┘
```

---

## Services & Ports

| Service | Description | Port |
|---------|-------------|------|
| FastAPI | REST API + SSE server | `8000` |
| PostgreSQL + pgvector | Primary datastore with vector extension | `5432` |
| Redis | PubSub broker for SSE delivery | `6379` |
| Kafka | Event streaming backbone | `9092` |
| Zookeeper | Kafka coordination | `2181` |
| Celery Worker | Background task executor | — |
| Kafka Consumer | Kafka → Celery dispatcher | — |
| Next.js | Frontend dev server | `3000` |

---

## Key Design Decisions

### Why Kafka + Celery?
Disruption events are decoupled from the API layer via Kafka. This means the `/events/simulate` endpoint returns immediately; the async processing (LangGraph agent) runs in a Celery worker. The two-stage dispatch (Kafka consumer → Celery task) lets the consumer be horizontally scaled independently of the agent workers.

### Why LangGraph?
The agent pipeline has discrete, inspectable stages (retrieve → search → plan → validate → commit). LangGraph's `StateGraph` makes the data flow explicit and each node unit-testable in isolation, unlike a single monolithic LLM call.

### Why pgvector for search?
Activities and destinations store OpenAI `text-embedding-ada-002` (1536-dim) vectors. When a disruption event arrives, the `search_alternatives` node runs a cosine-distance query directly in Postgres — no separate vector database required. Falls back to ILIKE keyword search when embeddings are not yet populated.

### Why SSE over WebSockets?
The agent-to-UI update is unidirectional (server → client). SSE is simpler to implement, proxy-friendly, and natively supported by browsers without a library. Redis PubSub acts as the broker between the Celery worker and the FastAPI SSE endpoint, allowing them to run in separate processes.

### Deterministic Validation Layer
Every LLM proposal is run through a rule engine (`validation.py`) before it can be committed. This enforces hard business constraints (budget caps, self-replacement guards) regardless of what the LLM outputs, ensuring the agent can never apply an invalid change.

---

## Data Model

```
users
  └─ trips (1:many)
       └─ itinerary_items (1:many)  → component_id → activities | guides

destinations
  ├─ activities (1:many)            embedding: Vector(1536)
  └─ guides (1:many)                embedding: Vector(1536)

agent_events                        (disruption inbox)
  └─ agent_actions (1:many)         (audit log: proposed_changes, validation_result, status)
```

---

## Running Locally

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.11+

### 1. Start infrastructure

```bash
docker compose up -d db redis zookeeper kafka
```

### 2. Run database migrations

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m app.db.seed        # seeds destinations, guides, activities
```

### 3. Start backend workers

```bash
# In separate terminals:
celery -A app.core.celery_app worker --loglevel=info
python -m app.tasks.consumer_worker
```

### 4. Start FastAPI

```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Start frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### Environment variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://packagepro_user:packagepro_password@localhost:5432/packagepro
REDIS_URL=redis://localhost:6379/0
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
OPENAI_API_KEY=sk-...          # optional — agent falls back gracefully without it
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Run everything with Docker Compose

```bash
docker compose up --build
```

---

## Running Tests

```bash
cd backend
pytest tests/ -v
```

The test suite covers:
- `PricingEngine` — deterministic price calculation with markup and tax
- LangGraph agent graph — end-to-end pipeline execution with status assertions

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TanStack Query v5, Zustand v5, Framer Motion, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Agent | LangGraph, LangChain OpenAI, GPT-4o-mini |
| Vector Search | pgvector (cosine distance), OpenAI `text-embedding-ada-002` |
| Messaging | Apache Kafka (confluent-kafka), Celery (Redis broker) |
| Real-time | Server-Sent Events, Redis PubSub |
| Database | PostgreSQL 15 + pgvector extension |
| Cache / Broker | Redis 7 |
| Containerisation | Docker, Docker Compose |
| Testing | pytest, pytest-asyncio |
