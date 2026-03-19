# Conductor — Design Document

**Date:** 2026-03-20
**Status:** Approved

## Overview

Conductor is a visual API workflow tester. Users define multi-step HTTP request flows once, set startup variables, and run them with one click. No code required. Designed for developers and QA engineers testing complex multi-step happy flows across multiple APIs and schemas.

**Core value:** Save a 5-step API flow once → run it forever without writing code.

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Backend | Rust (Axum) | Max runtime performance, async HTTP |
| HTTP client | reqwest | Async, battle-tested Rust HTTP client |
| Database | SQLite (sqlx) | Zero infra, self-hosted simplicity, migrate to Postgres for SaaS |
| Frontend | React + Vite + TypeScript | Fast dev, strong ecosystem |
| Deployment | Docker Compose | Single command self-host |
| Streaming | SSE (Server-Sent Events) | Real-time run progress to frontend |

---

## Data Model

```
Project
  - id, name, description, created_at

Workflow
  - id, project_id, name, description
  - startup_variables: [{name, default_value, description}]

Step
  - id, workflow_id, order_index, name
  - method: GET | POST | PUT | PATCH | DELETE
  - url: String                          # supports {{varName}} interpolation
  - headers: [{key, value}]              # values support {{varName}}
  - body: String                         # JSON template with {{varName}}
  - response_schema: [{path, alias, type}]  # extracts vars from response
  - on_success: CONTINUE | STOP
  - on_failure: STOP | CONTINUE

Condition  (gate evaluated after step N, before step N+1)
  - id, workflow_id, after_step_id
  - expression: String                   # e.g. "step1.amount == 0"
  - action: FAIL | STOP

WorkflowRun
  - id, workflow_id, started_at, finished_at
  - status: RUNNING | PASSED | FAILED
  - startup_variable_values: JSON
  - step_results: [{step_id, status, response_body, extracted_vars, error}]
```

**Variable reference syntax:** `{{varName}}` for startup variables, `{{step1.alias}}` for extracted response variables.

---

## Execution Engine

When a run is triggered:

1. Load workflow, steps, conditions, and startup variable values from SQLite
2. Seed variable context with startup variables
3. For each step in order:
   - Interpolate `{{varName}}` in URL, headers, and body
   - Execute HTTP request via reqwest
   - Parse response, extract variables into context per `response_schema`
   - Stream `step_complete` or `step_failed` event via SSE
   - Evaluate condition gate (if present): expression → FAIL/STOP or continue
4. Persist full run result to SQLite
5. Stream `run_complete` event

**Condition evaluator:** Lightweight built-in (not a JS sandbox). Supports `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`. Variables referenced as `stepN.alias`. No arbitrary code execution.

**On HTTP error:** Step marked FAILED, run stops — unless `on_failure: CONTINUE` is set.

---

## API Design

```
# Projects
GET    /api/projects
POST   /api/projects
DELETE /api/projects/:id

# Workflows
GET    /api/projects/:id/workflows
POST   /api/projects/:id/workflows
GET    /api/workflows/:id
PUT    /api/workflows/:id
DELETE /api/workflows/:id

# Steps
POST   /api/workflows/:id/steps
PUT    /api/steps/:id
DELETE /api/steps/:id
PATCH  /api/steps/:id/reorder

# Conditions
POST   /api/steps/:id/condition
PUT    /api/conditions/:id
DELETE /api/conditions/:id

# Runs
POST   /api/workflows/:id/run
GET    /api/workflows/:id/runs
GET    /api/runs/:id
GET    /api/runs/:id/stream          # SSE
```

**SSE event shapes:**
```json
{ "type": "step_start",     "step_id": "...", "step_name": "..." }
{ "type": "step_complete",  "step_id": "...", "status": "passed", "extracted": {} }
{ "type": "step_failed",    "step_id": "...", "error": "...", "response": "..." }
{ "type": "condition_fail", "condition_id": "...", "expression": "..." }
{ "type": "run_complete",   "status": "passed" }
```

---

## Frontend UI

### Pages

1. **Projects Dashboard** — grid of project cards, create/delete project
2. **Workflow Editor** — the primary screen:
   - Left panel: workflow list for the project
   - Center canvas: vertical step cards connected by arrows
   - Between steps: condition gate row (click to add/edit)
   - Side panel: step config (URL, method, headers, body, response schema)
   - `+` button to add steps
   - `{{` autocomplete in text fields — shows available variables at that point in flow
   - Top bar: Run button + startup variable input form
3. **Run View** — live execution view:
   - Step cards light up in real time via SSE: ⏳ → 🔄 → ✅ / ❌
   - Each step expandable: request sent, response received, variables extracted
   - Final status banner: PASSED / FAILED
   - Run history sidebar

---

## Infrastructure

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["3000:3000"]
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_URL=sqlite:///app/data/conductor.db

  frontend:
    build: ./frontend
    ports: ["5173:80"]
    environment:
      - VITE_API_URL=http://localhost:3000
```

SQLite file persisted to `./data/` on host. `docker compose up` → ready.

---

## Project Structure

```
conductor/
├── backend/
│   ├── src/
│   │   ├── main.rs
│   │   ├── routes/         # one file per resource
│   │   ├── models/         # DB structs
│   │   ├── engine/         # execution engine + condition evaluator
│   │   └── db/             # sqlx migrations + queries
│   └── Cargo.toml
├── frontend/
│   ├── src/
│   │   ├── pages/          # Dashboard, WorkflowEditor, RunView
│   │   ├── components/     # StepCard, ConditionGate, VariablePicker
│   │   └── api/            # typed fetch wrappers
│   └── package.json
├── docs/plans/
├── docker-compose.yml
└── CLAUDE.md
```

---

## Constraints & Future Work

- **v1:** No auth, single-user, self-hosted only
- **v2:** User accounts, team sharing, Postgres, SaaS deployment
- **Future:** Scheduled runs, parallel step groups, webhook triggers, environment profiles (dev/staging/prod)
