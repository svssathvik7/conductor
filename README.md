# Conductor

**Self-hosted visual API workflow tester.** Chain HTTP requests, extract response variables, add conditional gates, and run multi-step flows with one click — no code required.

> Think Postman Collections, but visual, sequential, and with built-in conditional logic.

---

## What It Does

1. **Define steps** — Each step is an HTTP request (GET, POST, PUT, PATCH, DELETE) with a URL, headers, body, and a response schema that extracts variables.
2. **Chain variables** — Use `{{step1.token}}` in any subsequent step's URL, headers, or body. Variables flow through the pipeline automatically.
3. **Add conditions** — Insert conditional gates between steps: `IF step1.amount < 100 → FAIL`. The run stops if the condition triggers.
4. **Run with one click** — Set startup variables (like base URL or auth token), hit Run, and watch each step execute in real time via Server-Sent Events.

---

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)

### Run Locally

```bash
# Clone
git clone https://github.com/svssathvik7/conductor.git
cd conductor

# Start backend (port 3000)
cd backend
cargo run --release &
cd ..

# Start frontend (port 5173)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** and start building workflows.

### Run with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

---

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Step 1     │     │  Condition   │     │   Step 2     │     │   Step 3     │
│  GET /price  │────▶│  IF price    │────▶│  GET /detail │────▶│  POST /hook  │
│              │     │  < 100 FAIL  │     │              │     │              │
│ extracts:    │     └─────────────┘     │ extracts:    │     │ uses:        │
│  btc_price   │                         │  volume      │     │  {{step1.*}} │
│  change_24h  │                         │  ath         │     │  {{step2.*}} │
└─────────────┘                         └─────────────┘     └─────────────┘
```

### Variable Interpolation

Any field (URL, headers, body) supports `{{varName}}` syntax:

| Variable | Source | Example |
|----------|--------|---------|
| `{{base_url}}` | Startup variable | Set before each run |
| `{{step1.token}}` | Step 1 response schema | Extracted via JSON path |
| `{{step2.amount}}` | Step 2 response schema | Extracted via JSON path |

### Response Schema

Define which fields to extract from a step's JSON response:

```json
[
  { "path": "result.data.token", "alias": "auth_token", "field_type": "String" },
  { "path": "result.count",      "alias": "item_count", "field_type": "Number" }
]
```

The `path` uses dot notation to traverse the JSON response. Extracted values become available as `{{stepN.alias}}` in subsequent steps.

### Condition Gates

Conditions sit between steps and act as guards:

```
IF step1.btc_price < 100 → FAIL
```

- If the expression is **true** → the action triggers (FAIL stops the run, STOP ends gracefully)
- If the expression is **false** → execution continues to the next step

Supported operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`

---

## API Reference

All endpoints are prefixed with `/api`.

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects` | List all projects |
| `POST` | `/projects` | Create a project |
| `DELETE` | `/projects/:id` | Delete a project |

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects/:id/workflows` | List workflows in a project |
| `POST` | `/projects/:id/workflows` | Create a workflow |
| `GET` | `/workflows/:id` | Get a workflow |
| `PUT` | `/workflows/:id` | Update a workflow |
| `DELETE` | `/workflows/:id` | Delete a workflow |

### Steps

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/workflows/:id/steps` | List steps in a workflow |
| `POST` | `/workflows/:id/steps` | Add a step (auto-assigns order) |
| `PUT` | `/steps/:id` | Update a step |
| `DELETE` | `/steps/:id` | Delete a step |
| `PATCH` | `/steps/:id/reorder` | Change step order |

### Conditions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/workflows/:id/conditions` | List conditions in a workflow |
| `POST` | `/steps/:id/condition` | Add a condition after a step |
| `PUT` | `/conditions/:id` | Update a condition |
| `DELETE` | `/conditions/:id` | Delete a condition |

### Runs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/workflows/:id/run` | Start a run (returns `run_id`) |
| `GET` | `/runs/:id/stream` | SSE stream of run events |
| `GET` | `/runs/:id` | Get run result |
| `GET` | `/workflows/:id/runs` | List past runs |

### SSE Events

When streaming a run, the server sends these events:

```json
{ "type": "step_start",     "step_id": "...", "step_name": "..." }
{ "type": "step_complete",  "step_id": "...", "status": "passed", "extracted": { ... } }
{ "type": "step_failed",    "step_id": "...", "error": "HTTP 500", "response": "..." }
{ "type": "condition_fail", "condition_id": "...", "expression": "..." }
{ "type": "run_complete",   "status": "passed" }
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust, Axum 0.7, Tokio |
| Database | SQLite (via sqlx) |
| HTTP Client | reqwest |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Data Fetching | TanStack Query |
| Streaming | Server-Sent Events (SSE) |
| Deployment | Docker Compose |

## Project Structure

```
conductor/
├── backend/
│   ├── src/
│   │   ├── main.rs            # Server entrypoint
│   │   ├── routes/            # API handlers (projects, workflows, steps, conditions, runs)
│   │   ├── models/            # Data types and constructors
│   │   ├── engine/
│   │   │   ├── runner.rs      # Workflow execution engine
│   │   │   ├── interpolator.rs # {{variable}} replacement
│   │   │   └── evaluator.rs   # Condition expression evaluator
│   │   └── db/                # Migration tests
│   └── migrations/            # SQLite schema
├── frontend/
│   ├── src/
│   │   ├── pages/             # Dashboard, ProjectPage, WorkflowEditor, RunPage
│   │   ├── components/        # StepCard, ConditionGate, StepConfigPanel, RunStepCard, etc.
│   │   └── api/               # Typed API clients
│   └── index.html
├── docker-compose.yml
└── docs/plans/                # Design documents
```

---

## Development

### Backend

```bash
cd backend
cargo run                    # Dev server on :3000
cargo test                   # Run all tests (28)
cargo build --release        # Production build
```

### Frontend

```bash
cd frontend
npm install
npm run dev                  # Dev server on :5173
npm run build                # Production build
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite://conductor.db` | SQLite database path |
| `VITE_API_URL` | `http://localhost:3000` | Backend URL (frontend) |

---

## License

MIT
