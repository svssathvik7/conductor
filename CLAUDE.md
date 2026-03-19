# Conductor

Visual API workflow tester — save multi-step API flows once, run them with one click.

## Project Overview

Conductor lets users define multi-step API workflows visually: chain HTTP requests, extract response variables, pass them into subsequent steps, and add conditional gates between steps. No code required.

## Tech Stack

- **Backend:** Rust (Axum) + SQLite (via sqlx)
- **Frontend:** React + Vite + TypeScript
- **Deployment:** Self-hosted via Docker Compose

## Architecture

- Linear pipeline execution engine (steps run sequentially)
- Server-side HTTP request execution (backend makes all API calls)
- SSE (Server-Sent Events) for real-time run progress streaming to frontend
- Variable interpolation using `{{varName}}` syntax in URLs, headers, and bodies
- Conditional gates between steps using simple expressions

## Project Structure

```
conductor/
├── backend/          # Rust/Axum server
├── frontend/         # React/Vite app
├── docs/
│   └── plans/        # Design docs and implementation plans
└── docker-compose.yml
```

## Conventions

- Git branches: `feat/{feature}`, `fix/{bug}`, `chore/{task}`
- No co-author tags in commits
- No "Generated with Claude Code" tags in PRs

## Key Concepts

- **Project** — a container for related workflows (e.g. "Garden Mainnet")
- **Workflow** — a named sequence of steps (e.g. "Order Testing Happy Flow")
- **Step** — a single HTTP request with URL, method, headers, body, and response schema
- **Startup Variables** — variables the user sets before each run (e.g. base URL, auth token)
- **Condition** — an if-else gate evaluated between steps (e.g. `if step1.amount == 0 → FAIL`)
- **Run** — one execution of a workflow, with full result history
