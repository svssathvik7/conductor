# Conductor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Conductor — a self-hosted visual API workflow tester where users chain HTTP requests, extract response variables, and run multi-step flows with one click.

**Architecture:** Rust/Axum backend executes HTTP requests server-side, streams results via SSE. React/Vite frontend renders a visual step canvas with live run updates. SQLite stores all data via sqlx.

**Tech Stack:** Rust (axum, sqlx, reqwest, tokio), React + Vite + TypeScript (react-query, react-router-dom, Tailwind CSS), Docker Compose.

**PR Strategy:** Every task below = one PR. Branch: `feat/{task-name}`.

---

## Task 1: Backend Scaffold

**PR:** `feat/backend-scaffold`

**Files:**
- Create: `backend/Cargo.toml`
- Create: `backend/src/main.rs`
- Create: `backend/src/routes/mod.rs`
- Create: `backend/src/models/mod.rs`
- Create: `backend/src/db/mod.rs`
- Create: `backend/src/engine/mod.rs`

**Step 1: Init Rust project**

```bash
cd ~/Desktop/sathvik/my-projects/conductor
cargo new backend
```

**Step 2: Set dependencies in `backend/Cargo.toml`**

```toml
[package]
name = "conductor"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = { version = "0.7", features = ["macros"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "sqlite", "migrate", "json"] }
reqwest = { version = "0.12", features = ["json"] }
tower-http = { version = "0.5", features = ["cors"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
tokio-stream = "0.1"
anyhow = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
dotenvy = "0.15"

[dev-dependencies]
axum-test = "14"
```

**Step 3: Write `backend/src/main.rs`**

```rust
use axum::{Router, http::Method};
use sqlx::sqlite::SqlitePoolOptions;
use tower_http::cors::{CorsLayer, Any};
use std::net::SocketAddr;

mod db;
mod engine;
mod models;
mod routes;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite://conductor.db".to_string());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::PATCH])
        .allow_headers(Any)
        .allow_origin(Any);

    let app = Router::new()
        .nest("/api", routes::router())
        .with_state(pool)
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("Listening on {}", addr);
    axum::Server::bind(&addr).serve(app.into_make_service()).await?;
    Ok(())
}
```

**Step 4: Create empty module files**

```rust
// backend/src/routes/mod.rs
use axum::Router;
use sqlx::SqlitePool;

pub fn router() -> Router<SqlitePool> {
    Router::new()
}

// backend/src/models/mod.rs
// backend/src/db/mod.rs
// backend/src/engine/mod.rs
```

**Step 5: Verify it compiles**

```bash
cd backend && cargo build
```
Expected: Compiles with no errors.

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: backend scaffold with axum and sqlx"
```

---

## Task 2: Frontend Scaffold

**PR:** `feat/frontend-scaffold`

**Files:**
- Create: `frontend/` (Vite project)
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/pages/WorkflowEditor.tsx`
- Create: `frontend/src/pages/RunView.tsx`

**Step 1: Scaffold Vite project**

```bash
cd ~/Desktop/sathvik/my-projects/conductor
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install @tanstack/react-query react-router-dom axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Step 2: Configure Tailwind in `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 3: Configure `frontend/tailwind.config.js`**

```js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

**Step 4: Write `frontend/src/api/client.ts`**

```ts
import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
})
```

**Step 5: Write `frontend/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import Dashboard from './pages/Dashboard'
import WorkflowEditor from './pages/WorkflowEditor'
import RunView from './pages/RunView'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects/:projectId/workflows/:workflowId" element={<WorkflowEditor />} />
          <Route path="/runs/:runId" element={<RunView />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
```

**Step 6: Write stub pages**

```tsx
// frontend/src/pages/Dashboard.tsx
export default function Dashboard() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Conductor</h1></div>
}

// frontend/src/pages/WorkflowEditor.tsx
export default function WorkflowEditor() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Workflow Editor</h1></div>
}

// frontend/src/pages/RunView.tsx
export default function RunView() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Run View</h1></div>
}
```

**Step 7: Verify it runs**

```bash
cd frontend && npm run dev
```
Expected: Vite server starts on `http://localhost:5173`, page shows "Conductor".

**Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold with vite, react-query, tailwind"
```

---

## Task 3: Docker Compose

**PR:** `feat/docker-compose`

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `frontend/.env.example`
- Create: `backend/.env.example`

**Step 1: Write `backend/Dockerfile`**

```dockerfile
FROM rust:1.77-slim as builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/conductor .
COPY --from=builder /app/migrations ./migrations
CMD ["./conductor"]
```

**Step 2: Write `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

**Step 3: Write `docker-compose.yml`**

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_URL=sqlite:///app/data/conductor.db
      - PORT=3000
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "5173:80"
    environment:
      - VITE_API_URL=http://localhost:3000
    depends_on:
      - backend
    restart: unless-stopped
```

**Step 4: Write env examples**

```bash
# backend/.env.example
DATABASE_URL=sqlite://conductor.db
PORT=3000

# frontend/.env.example
VITE_API_URL=http://localhost:3000
```

**Step 5: Commit**

```bash
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile
git commit -m "feat: docker compose setup for self-hosted deployment"
```

---

## Task 4: Database Migrations

**PR:** `feat/db-migrations`

**Files:**
- Create: `backend/migrations/001_initial.sql`

**Step 1: Create migrations directory**

```bash
mkdir -p backend/migrations
```

**Step 2: Write `backend/migrations/001_initial.sql`**

```sql
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    startup_variables TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS steps (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    name TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    url TEXT NOT NULL DEFAULT '',
    headers TEXT NOT NULL DEFAULT '[]',
    body TEXT NOT NULL DEFAULT '',
    response_schema TEXT NOT NULL DEFAULT '[]',
    on_success TEXT NOT NULL DEFAULT 'CONTINUE',
    on_failure TEXT NOT NULL DEFAULT 'STOP'
);

CREATE TABLE IF NOT EXISTS conditions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    after_step_id TEXT NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
    expression TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'FAIL'
);

CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    startup_variable_values TEXT NOT NULL DEFAULT '{}',
    step_results TEXT NOT NULL DEFAULT '[]'
);
```

**Step 3: Write `backend/src/db/mod.rs` — run migration test**

```rust
#[cfg(test)]
mod tests {
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn migrations_run_cleanly() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    }
}
```

**Step 4: Run migration test**

```bash
cd backend && cargo test migrations_run_cleanly
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/migrations/ backend/src/db/
git commit -m "feat: sqlite migrations for all conductor tables"
```

---

## Task 5: Projects API

**PR:** `feat/projects-api`

**Files:**
- Create: `backend/src/models/project.rs`
- Create: `backend/src/routes/projects.rs`
- Modify: `backend/src/models/mod.rs`
- Modify: `backend/src/routes/mod.rs`

**Step 1: Write `backend/src/models/project.rs`**

```rust
use serde::{Deserialize, Serialize};
use chrono::Utc;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProject {
    pub name: String,
    pub description: Option<String>,
}

impl Project {
    pub fn new(name: String, description: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            description,
            created_at: Utc::now().to_rfc3339(),
        }
    }
}
```

**Step 2: Write `backend/src/routes/projects.rs`**

```rust
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use sqlx::SqlitePool;
use crate::models::project::{CreateProject, Project};

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route("/projects", get(list_projects).post(create_project))
        .route("/projects/:id", delete(delete_project))
}

async fn list_projects(State(pool): State<SqlitePool>) -> Json<Vec<Project>> {
    let projects = sqlx::query_as::<_, Project>("SELECT * FROM projects ORDER BY created_at DESC")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
    Json(projects)
}

async fn create_project(
    State(pool): State<SqlitePool>,
    Json(payload): Json<CreateProject>,
) -> (StatusCode, Json<Project>) {
    let project = Project::new(payload.name, payload.description.unwrap_or_default());
    sqlx::query("INSERT INTO projects (id, name, description, created_at) VALUES (?, ?, ?, ?)")
        .bind(&project.id)
        .bind(&project.name)
        .bind(&project.description)
        .bind(&project.created_at)
        .execute(&pool)
        .await
        .unwrap();
    (StatusCode::CREATED, Json(project))
}

async fn delete_project(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> StatusCode {
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .unwrap();
    StatusCode::NO_CONTENT
}
```

**Step 3: Write test for projects API**

```rust
// at bottom of backend/src/routes/projects.rs
#[cfg(test)]
mod tests {
    use super::*;
    use axum_test::TestServer;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_and_list_project() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server.post("/api/projects")
            .json(&serde_json::json!({"name": "Test Project"}))
            .await;
        res.assert_status_created();
        let project: Project = res.json();
        assert_eq!(project.name, "Test Project");

        let res = server.get("/api/projects").await;
        res.assert_status_ok();
        let projects: Vec<Project> = res.json();
        assert_eq!(projects.len(), 1);
    }
}
```

**Step 4: Run tests**

```bash
cd backend && cargo test test_create_and_list_project
```
Expected: PASS

**Step 5: Wire into main router in `backend/src/routes/mod.rs`**

```rust
use axum::Router;
use sqlx::SqlitePool;
mod projects;

pub fn router() -> Router<SqlitePool> {
    Router::new().merge(projects::router())
}
```

**Step 6: Commit**

```bash
git add backend/src/
git commit -m "feat: projects CRUD API (list, create, delete)"
```

---

## Task 6: Workflows API

**PR:** `feat/workflows-api`

**Files:**
- Create: `backend/src/models/workflow.rs`
- Create: `backend/src/routes/workflows.rs`
- Modify: `backend/src/models/mod.rs`
- Modify: `backend/src/routes/mod.rs`

**Step 1: Write `backend/src/models/workflow.rs`**

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
pub struct StartupVariable {
    pub name: String,
    pub default_value: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Workflow {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: String,
    pub startup_variables: String, // JSON string of Vec<StartupVariable>
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkflow {
    pub name: String,
    pub description: Option<String>,
    pub startup_variables: Option<Vec<StartupVariable>>,
}

impl Workflow {
    pub fn new(project_id: String, name: String, description: String, startup_variables: Vec<StartupVariable>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            project_id,
            name,
            description,
            startup_variables: serde_json::to_string(&startup_variables).unwrap_or("[]".to_string()),
            created_at: Utc::now().to_rfc3339(),
        }
    }
}
```

**Step 2: Write `backend/src/routes/workflows.rs`**

```rust
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use sqlx::SqlitePool;
use crate::models::workflow::{CreateWorkflow, Workflow};

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route("/projects/:project_id/workflows", get(list_workflows).post(create_workflow))
        .route("/workflows/:id", get(get_workflow).put(update_workflow).delete(delete_workflow))
}

async fn list_workflows(
    State(pool): State<SqlitePool>,
    Path(project_id): Path<String>,
) -> Json<Vec<Workflow>> {
    let workflows = sqlx::query_as::<_, Workflow>(
        "SELECT * FROM workflows WHERE project_id = ? ORDER BY created_at DESC"
    )
    .bind(&project_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(workflows)
}

async fn get_workflow(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Workflow>, StatusCode> {
    sqlx::query_as::<_, Workflow>("SELECT * FROM workflows WHERE id = ?")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .unwrap()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn create_workflow(
    State(pool): State<SqlitePool>,
    Path(project_id): Path<String>,
    Json(payload): Json<CreateWorkflow>,
) -> (StatusCode, Json<Workflow>) {
    let workflow = Workflow::new(
        project_id,
        payload.name,
        payload.description.unwrap_or_default(),
        payload.startup_variables.unwrap_or_default(),
    );
    sqlx::query(
        "INSERT INTO workflows (id, project_id, name, description, startup_variables, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&workflow.id).bind(&workflow.project_id).bind(&workflow.name)
    .bind(&workflow.description).bind(&workflow.startup_variables).bind(&workflow.created_at)
    .execute(&pool).await.unwrap();
    (StatusCode::CREATED, Json(workflow))
}

async fn update_workflow(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<CreateWorkflow>,
) -> Result<Json<Workflow>, StatusCode> {
    let startup_vars = serde_json::to_string(&payload.startup_variables.unwrap_or_default()).unwrap();
    sqlx::query("UPDATE workflows SET name = ?, description = ?, startup_variables = ? WHERE id = ?")
        .bind(payload.name).bind(payload.description.unwrap_or_default())
        .bind(startup_vars).bind(&id)
        .execute(&pool).await.unwrap();
    get_workflow(State(pool), Path(id)).await
}

async fn delete_workflow(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> StatusCode {
    sqlx::query("DELETE FROM workflows WHERE id = ?").bind(&id).execute(&pool).await.unwrap();
    StatusCode::NO_CONTENT
}
```

**Step 3: Add test**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use axum_test::TestServer;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new().connect("sqlite::memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_workflow_crud() {
        let pool = test_pool().await;
        // seed a project
        sqlx::query("INSERT INTO projects (id, name, description, created_at) VALUES ('p1', 'P', '', '2024-01-01')")
            .execute(&pool).await.unwrap();

        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server.post("/api/projects/p1/workflows")
            .json(&serde_json::json!({"name": "Happy Flow"})).await;
        res.assert_status_created();
        let wf: Workflow = res.json();
        assert_eq!(wf.name, "Happy Flow");
    }
}
```

**Step 4: Run tests**

```bash
cd backend && cargo test test_workflow_crud
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: workflows CRUD API"
```

---

## Task 7: Steps API

**PR:** `feat/steps-api`

**Files:**
- Create: `backend/src/models/step.rs`
- Create: `backend/src/routes/steps.rs`

**Step 1: Write `backend/src/models/step.rs`**

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Header {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResponseSchemaField {
    pub path: String,   // e.g. "result.amount"
    pub alias: String,  // e.g. "amount"
    pub field_type: String, // "String" | "Number" | "Boolean"
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Step {
    pub id: String,
    pub workflow_id: String,
    pub order_index: i64,
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: String,        // JSON
    pub body: String,
    pub response_schema: String, // JSON
    pub on_success: String,
    pub on_failure: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateStep {
    pub name: String,
    pub method: Option<String>,
    pub url: Option<String>,
    pub headers: Option<Vec<Header>>,
    pub body: Option<String>,
    pub response_schema: Option<Vec<ResponseSchemaField>>,
    pub on_success: Option<String>,
    pub on_failure: Option<String>,
}

impl Step {
    pub fn new(workflow_id: String, order_index: i64, payload: CreateStep) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            workflow_id,
            order_index,
            name: payload.name,
            method: payload.method.unwrap_or_else(|| "GET".to_string()),
            url: payload.url.unwrap_or_default(),
            headers: serde_json::to_string(&payload.headers.unwrap_or_default()).unwrap(),
            body: payload.body.unwrap_or_default(),
            response_schema: serde_json::to_string(&payload.response_schema.unwrap_or_default()).unwrap(),
            on_success: payload.on_success.unwrap_or_else(|| "CONTINUE".to_string()),
            on_failure: payload.on_failure.unwrap_or_else(|| "STOP".to_string()),
        }
    }
}
```

**Step 2: Write `backend/src/routes/steps.rs`** (list, create, update, delete, reorder)

```rust
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, patch, post, put},
    Json, Router,
};
use sqlx::SqlitePool;
use crate::models::step::{CreateStep, Step};

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route("/workflows/:workflow_id/steps", get(list_steps).post(create_step))
        .route("/steps/:id", put(update_step).delete(delete_step))
        .route("/steps/:id/reorder", patch(reorder_step))
}

async fn list_steps(State(pool): State<SqlitePool>, Path(wid): Path<String>) -> Json<Vec<Step>> {
    let steps = sqlx::query_as::<_, Step>(
        "SELECT * FROM steps WHERE workflow_id = ? ORDER BY order_index ASC"
    ).bind(&wid).fetch_all(&pool).await.unwrap_or_default();
    Json(steps)
}

async fn create_step(
    State(pool): State<SqlitePool>,
    Path(wid): Path<String>,
    Json(payload): Json<CreateStep>,
) -> (StatusCode, Json<Step>) {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM steps WHERE workflow_id = ?")
        .bind(&wid).fetch_one(&pool).await.unwrap_or(0);
    let step = Step::new(wid, count, payload);
    sqlx::query(
        "INSERT INTO steps (id, workflow_id, order_index, name, method, url, headers, body, response_schema, on_success, on_failure) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(&step.id).bind(&step.workflow_id).bind(step.order_index).bind(&step.name)
    .bind(&step.method).bind(&step.url).bind(&step.headers).bind(&step.body)
    .bind(&step.response_schema).bind(&step.on_success).bind(&step.on_failure)
    .execute(&pool).await.unwrap();
    (StatusCode::CREATED, Json(step))
}

async fn update_step(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<CreateStep>,
) -> StatusCode {
    let headers = serde_json::to_string(&payload.headers.unwrap_or_default()).unwrap();
    let schema = serde_json::to_string(&payload.response_schema.unwrap_or_default()).unwrap();
    sqlx::query(
        "UPDATE steps SET name=?, method=?, url=?, headers=?, body=?, response_schema=?, on_success=?, on_failure=? WHERE id=?"
    )
    .bind(&payload.name).bind(payload.method.unwrap_or_else(||"GET".to_string()))
    .bind(payload.url.unwrap_or_default()).bind(headers).bind(payload.body.unwrap_or_default())
    .bind(schema).bind(payload.on_success.unwrap_or_else(||"CONTINUE".to_string()))
    .bind(payload.on_failure.unwrap_or_else(||"STOP".to_string())).bind(&id)
    .execute(&pool).await.unwrap();
    StatusCode::OK
}

async fn delete_step(State(pool): State<SqlitePool>, Path(id): Path<String>) -> StatusCode {
    sqlx::query("DELETE FROM steps WHERE id = ?").bind(&id).execute(&pool).await.unwrap();
    StatusCode::NO_CONTENT
}

#[derive(serde::Deserialize)]
pub struct ReorderPayload { pub new_index: i64 }

async fn reorder_step(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<ReorderPayload>,
) -> StatusCode {
    sqlx::query("UPDATE steps SET order_index = ? WHERE id = ?")
        .bind(payload.new_index).bind(&id).execute(&pool).await.unwrap();
    StatusCode::OK
}
```

**Step 3: Test**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use axum_test::TestServer;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new().connect("sqlite::memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        sqlx::query("INSERT INTO projects (id,name,description,created_at) VALUES ('p1','P','','2024-01-01')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO workflows (id,project_id,name,description,startup_variables,created_at) VALUES ('w1','p1','W','','[]','2024-01-01')")
            .execute(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_step() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();
        let res = server.post("/api/workflows/w1/steps")
            .json(&serde_json::json!({"name": "Get Token", "method": "POST", "url": "https://api.example.com/auth"}))
            .await;
        res.assert_status_created();
        let step: Step = res.json();
        assert_eq!(step.name, "Get Token");
        assert_eq!(step.order_index, 0);
    }
}
```

**Step 4: Run tests**

```bash
cd backend && cargo test test_create_step
```
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: steps CRUD API with reorder support"
```

---

## Task 8: Conditions API

**PR:** `feat/conditions-api`

**Files:**
- Create: `backend/src/models/condition.rs`
- Create: `backend/src/routes/conditions.rs`

**Step 1: Write `backend/src/models/condition.rs`**

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Condition {
    pub id: String,
    pub workflow_id: String,
    pub after_step_id: String,
    pub expression: String,
    pub action: String, // "FAIL" | "STOP"
}

#[derive(Debug, Deserialize)]
pub struct CreateCondition {
    pub workflow_id: String,
    pub expression: String,
    pub action: Option<String>,
}

impl Condition {
    pub fn new(after_step_id: String, workflow_id: String, expression: String, action: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            workflow_id,
            after_step_id,
            expression,
            action,
        }
    }
}
```

**Step 2: Write `backend/src/routes/conditions.rs`**

```rust
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, post, put},
    Json, Router,
};
use sqlx::SqlitePool;
use crate::models::condition::{Condition, CreateCondition};

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route("/steps/:step_id/condition", post(create_condition))
        .route("/conditions/:id", put(update_condition).delete(delete_condition))
}

async fn create_condition(
    State(pool): State<SqlitePool>,
    Path(step_id): Path<String>,
    Json(payload): Json<CreateCondition>,
) -> (StatusCode, Json<Condition>) {
    let condition = Condition::new(
        step_id, payload.workflow_id,
        payload.expression,
        payload.action.unwrap_or_else(|| "FAIL".to_string()),
    );
    sqlx::query(
        "INSERT INTO conditions (id, workflow_id, after_step_id, expression, action) VALUES (?,?,?,?,?)"
    )
    .bind(&condition.id).bind(&condition.workflow_id).bind(&condition.after_step_id)
    .bind(&condition.expression).bind(&condition.action)
    .execute(&pool).await.unwrap();
    (StatusCode::CREATED, Json(condition))
}

async fn update_condition(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<CreateCondition>,
) -> StatusCode {
    sqlx::query("UPDATE conditions SET expression=?, action=? WHERE id=?")
        .bind(payload.expression)
        .bind(payload.action.unwrap_or_else(|| "FAIL".to_string()))
        .bind(&id)
        .execute(&pool).await.unwrap();
    StatusCode::OK
}

async fn delete_condition(State(pool): State<SqlitePool>, Path(id): Path<String>) -> StatusCode {
    sqlx::query("DELETE FROM conditions WHERE id=?").bind(&id).execute(&pool).await.unwrap();
    StatusCode::NO_CONTENT
}
```

**Step 3: Commit**

```bash
git add backend/src/
git commit -m "feat: conditions CRUD API"
```

---

## Task 9: Variable Interpolation Engine

**PR:** `feat/variable-interpolation`

**Files:**
- Create: `backend/src/engine/interpolator.rs`

**Step 1: Write failing test first**

```rust
// backend/src/engine/interpolator.rs
#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_simple_interpolation() {
        let mut ctx = HashMap::new();
        ctx.insert("base_url".to_string(), "https://api.example.com".to_string());
        let result = interpolate("{{base_url}}/orders", &ctx);
        assert_eq!(result, "https://api.example.com/orders");
    }

    #[test]
    fn test_nested_var() {
        let mut ctx = HashMap::new();
        ctx.insert("step1.token".to_string(), "abc123".to_string());
        let result = interpolate("Bearer {{step1.token}}", &ctx);
        assert_eq!(result, "Bearer abc123");
    }

    #[test]
    fn test_missing_var_stays_as_is() {
        let ctx = HashMap::new();
        let result = interpolate("{{unknown}}", &ctx);
        assert_eq!(result, "{{unknown}}");
    }
}
```

**Step 2: Run test to verify it fails**

```bash
cd backend && cargo test test_simple_interpolation
```
Expected: FAIL — `interpolate` not defined.

**Step 3: Implement `interpolate`**

```rust
use std::collections::HashMap;

pub fn interpolate(template: &str, ctx: &HashMap<String, String>) -> String {
    let mut result = template.to_string();
    for (key, value) in ctx {
        let placeholder = format!("{{{{{}}}}}", key);
        result = result.replace(&placeholder, value);
    }
    result
}
```

**Step 4: Run tests**

```bash
cd backend && cargo test interpolator
```
Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add backend/src/engine/
git commit -m "feat: variable interpolation engine with {{varName}} syntax"
```

---

## Task 10: Condition Expression Evaluator

**PR:** `feat/condition-evaluator`

**Files:**
- Create: `backend/src/engine/evaluator.rs`

**Step 1: Write failing tests**

```rust
// backend/src/engine/evaluator.rs
#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn ctx(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn test_equals_string() {
        let c = ctx(&[("step1.status", "ok")]);
        assert_eq!(evaluate("step1.status == \"ok\"", &c), Ok(true));
    }

    #[test]
    fn test_not_equals() {
        let c = ctx(&[("step1.amount", "0")]);
        assert_eq!(evaluate("step1.amount != \"0\"", &c), Ok(false));
    }

    #[test]
    fn test_numeric_greater_than() {
        let c = ctx(&[("step1.count", "5")]);
        assert_eq!(evaluate("step1.count > 3", &c), Ok(true));
    }

    #[test]
    fn test_and_operator() {
        let c = ctx(&[("step1.ok", "true"), ("step2.ready", "true")]);
        assert_eq!(evaluate("step1.ok == \"true\" && step2.ready == \"true\"", &c), Ok(true));
    }

    #[test]
    fn test_unknown_var_returns_err() {
        let c = ctx(&[]);
        assert!(evaluate("unknown.var == \"x\"", &c).is_err());
    }
}
```

**Step 2: Run to verify fail**

```bash
cd backend && cargo test evaluator
```
Expected: FAIL

**Step 3: Implement evaluator**

```rust
use std::collections::HashMap;

#[derive(Debug, PartialEq)]
pub enum EvalError { UnknownVariable(String), ParseError(String) }

pub fn evaluate(expr: &str, ctx: &HashMap<String, String>) -> Result<bool, EvalError> {
    // Handle && — split on " && " and AND all sub-expressions
    if expr.contains(" && ") {
        return expr.split(" && ")
            .map(|e| evaluate(e.trim(), ctx))
            .try_fold(true, |acc, r| r.map(|v| acc && v));
    }
    // Handle || — split on " || " and OR all sub-expressions
    if expr.contains(" || ") {
        return expr.split(" || ")
            .map(|e| evaluate(e.trim(), ctx))
            .try_fold(false, |acc, r| r.map(|v| acc || v));
    }

    // Single comparison: LHS OP RHS
    let ops = ["==", "!=", ">=", "<=", ">", "<"];
    for op in &ops {
        if let Some(idx) = expr.find(op) {
            let lhs = expr[..idx].trim();
            let rhs = expr[idx + op.len()..].trim().trim_matches('"');

            let lhs_val = ctx.get(lhs)
                .ok_or_else(|| EvalError::UnknownVariable(lhs.to_string()))?;

            return Ok(match *op {
                "==" => lhs_val.as_str() == rhs,
                "!=" => lhs_val.as_str() != rhs,
                ">"  => lhs_val.parse::<f64>().unwrap_or(0.0) > rhs.parse::<f64>().unwrap_or(0.0),
                "<"  => lhs_val.parse::<f64>().unwrap_or(0.0) < rhs.parse::<f64>().unwrap_or(0.0),
                ">=" => lhs_val.parse::<f64>().unwrap_or(0.0) >= rhs.parse::<f64>().unwrap_or(0.0),
                "<=" => lhs_val.parse::<f64>().unwrap_or(0.0) <= rhs.parse::<f64>().unwrap_or(0.0),
                _    => false,
            });
        }
    }
    Err(EvalError::ParseError(format!("Cannot parse: {}", expr)))
}
```

**Step 4: Run tests**

```bash
cd backend && cargo test evaluator
```
Expected: All 5 PASS.

**Step 5: Commit**

```bash
git add backend/src/engine/
git commit -m "feat: condition expression evaluator (==, !=, >, <, &&, ||)"
```

---

## Task 11: Workflow Execution Engine

**PR:** `feat/execution-engine`

**Files:**
- Create: `backend/src/engine/runner.rs`
- Modify: `backend/src/routes/mod.rs` (add run route)
- Create: `backend/src/routes/runs.rs`

**Step 1: Write `backend/src/engine/runner.rs`**

```rust
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use crate::engine::{interpolator::interpolate, evaluator::evaluate};
use crate::models::{step::Step, condition::Condition};

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RunEvent {
    StepStart    { step_id: String, step_name: String },
    StepComplete { step_id: String, status: String, extracted: HashMap<String, String> },
    StepFailed   { step_id: String, error: String, response: String },
    ConditionFail{ condition_id: String, expression: String },
    RunComplete  { status: String },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StepResult {
    pub step_id: String,
    pub status: String,
    pub response_body: String,
    pub extracted_vars: HashMap<String, String>,
    pub error: Option<String>,
}

pub async fn run_workflow(
    pool: &SqlitePool,
    workflow_id: &str,
    startup_vars: HashMap<String, String>,
    tx: tokio::sync::mpsc::Sender<RunEvent>,
) -> Vec<StepResult> {
    let steps: Vec<Step> = sqlx::query_as::<_, Step>(
        "SELECT * FROM steps WHERE workflow_id = ? ORDER BY order_index ASC"
    ).bind(workflow_id).fetch_all(pool).await.unwrap_or_default();

    let conditions: Vec<Condition> = sqlx::query_as::<_, Condition>(
        "SELECT * FROM conditions WHERE workflow_id = ?"
    ).bind(workflow_id).fetch_all(pool).await.unwrap_or_default();

    let mut ctx: HashMap<String, String> = startup_vars;
    let mut results: Vec<StepResult> = vec![];
    let client = reqwest::Client::new();

    for step in &steps {
        let _ = tx.send(RunEvent::StepStart {
            step_id: step.id.clone(),
            step_name: step.name.clone(),
        }).await;

        let url = interpolate(&step.url, &ctx);
        let body = interpolate(&step.body, &ctx);

        let headers: Vec<crate::models::step::Header> =
            serde_json::from_str(&step.headers).unwrap_or_default();

        let mut req = client.request(
            step.method.parse().unwrap_or(reqwest::Method::GET),
            &url,
        );
        for h in &headers {
            req = req.header(interpolate(&h.key, &ctx), interpolate(&h.value, &ctx));
        }
        if !body.is_empty() {
            req = req.body(body).header("content-type", "application/json");
        }

        match req.send().await {
            Ok(resp) => {
                let status = resp.status();
                let body_text = resp.text().await.unwrap_or_default();
                let body_json: serde_json::Value = serde_json::from_str(&body_text).unwrap_or(serde_json::Value::Null);

                // Extract variables from response
                let schema: Vec<crate::models::step::ResponseSchemaField> =
                    serde_json::from_str(&step.response_schema).unwrap_or_default();
                let mut extracted = HashMap::new();
                for field in &schema {
                    let val = resolve_json_path(&body_json, &field.path);
                    let key = format!("step{}.{}", step.order_index + 1, field.alias);
                    ctx.insert(key.clone(), val.clone());
                    extracted.insert(field.alias.clone(), val);
                }

                if status.is_success() || step.on_failure == "CONTINUE" {
                    let _ = tx.send(RunEvent::StepComplete {
                        step_id: step.id.clone(),
                        status: "passed".to_string(),
                        extracted: extracted.clone(),
                    }).await;
                    results.push(StepResult {
                        step_id: step.id.clone(), status: "passed".to_string(),
                        response_body: body_text, extracted_vars: extracted, error: None,
                    });
                } else {
                    let _ = tx.send(RunEvent::StepFailed {
                        step_id: step.id.clone(),
                        error: format!("HTTP {}", status),
                        response: body_text.clone(),
                    }).await;
                    results.push(StepResult {
                        step_id: step.id.clone(), status: "failed".to_string(),
                        response_body: body_text, extracted_vars: extracted,
                        error: Some(format!("HTTP {}", status)),
                    });
                    let _ = tx.send(RunEvent::RunComplete { status: "failed".to_string() }).await;
                    return results;
                }
            }
            Err(e) => {
                let _ = tx.send(RunEvent::StepFailed {
                    step_id: step.id.clone(),
                    error: e.to_string(),
                    response: "".to_string(),
                }).await;
                results.push(StepResult {
                    step_id: step.id.clone(), status: "failed".to_string(),
                    response_body: "".to_string(), extracted_vars: HashMap::new(),
                    error: Some(e.to_string()),
                });
                let _ = tx.send(RunEvent::RunComplete { status: "failed".to_string() }).await;
                return results;
            }
        }

        // Evaluate condition gate after this step
        if let Some(cond) = conditions.iter().find(|c| c.after_step_id == step.id) {
            match evaluate(&cond.expression, &ctx) {
                Ok(true) => {} // condition passes, continue
                Ok(false) => {
                    let _ = tx.send(RunEvent::ConditionFail {
                        condition_id: cond.id.clone(),
                        expression: cond.expression.clone(),
                    }).await;
                    let _ = tx.send(RunEvent::RunComplete { status: "failed".to_string() }).await;
                    return results;
                }
                Err(_) => {} // evaluation error, skip condition
            }
        }

        if step.on_success == "STOP" {
            break;
        }
    }

    let _ = tx.send(RunEvent::RunComplete { status: "passed".to_string() }).await;
    results
}

fn resolve_json_path(value: &serde_json::Value, path: &str) -> String {
    let mut current = value;
    for key in path.split('.') {
        match current.get(key) {
            Some(v) => current = v,
            None => return "".to_string(),
        }
    }
    match current {
        serde_json::Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}
```

**Step 2: Commit**

```bash
git add backend/src/engine/
git commit -m "feat: workflow execution engine with variable extraction and condition gates"
```

---

## Task 12: SSE Run Streaming

**PR:** `feat/sse-streaming`

**Files:**
- Create: `backend/src/routes/runs.rs`
- Modify: `backend/src/routes/mod.rs`

**Step 1: Write `backend/src/routes/runs.rs`**

```rust
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::sse::{Event, Sse},
    routing::{get, post},
    Json, Router,
};
use futures::stream::Stream;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::convert::Infallible;
use tokio_stream::wrappers::ReceiverStream;
use uuid::Uuid;
use chrono::Utc;
use crate::engine::runner::{run_workflow, RunEvent};

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route("/workflows/:id/run", post(start_run))
        .route("/workflows/:id/runs", get(list_runs))
        .route("/runs/:id", get(get_run))
        .route("/runs/:id/stream", get(stream_run))
}

#[derive(serde::Deserialize)]
pub struct StartRunPayload {
    pub startup_variable_values: Option<HashMap<String, String>>,
}

async fn start_run(
    State(pool): State<SqlitePool>,
    Path(workflow_id): Path<String>,
    Json(payload): Json<StartRunPayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    let run_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();
    let startup_vars = payload.startup_variable_values.unwrap_or_default();
    let vars_json = serde_json::to_string(&startup_vars).unwrap();

    sqlx::query(
        "INSERT INTO workflow_runs (id, workflow_id, started_at, status, startup_variable_values, step_results) VALUES (?,?,?,'RUNNING',?,'[]')"
    )
    .bind(&run_id).bind(&workflow_id).bind(&started_at).bind(&vars_json)
    .execute(&pool).await.unwrap();

    // Spawn the run in the background, persist results when done
    let pool_clone = pool.clone();
    let run_id_clone = run_id.clone();
    let workflow_id_clone = workflow_id.clone();
    tokio::spawn(async move {
        let (tx, _rx) = tokio::sync::mpsc::channel(100);
        let results = run_workflow(&pool_clone, &workflow_id_clone, startup_vars, tx).await;
        let results_json = serde_json::to_string(&results).unwrap();
        let status = if results.iter().any(|r| r.status == "failed") { "FAILED" } else { "PASSED" };
        sqlx::query("UPDATE workflow_runs SET status=?, finished_at=?, step_results=? WHERE id=?")
            .bind(status).bind(Utc::now().to_rfc3339()).bind(results_json).bind(&run_id_clone)
            .execute(&pool_clone).await.unwrap();
    });

    (StatusCode::CREATED, Json(serde_json::json!({ "run_id": run_id })))
}

async fn stream_run(
    State(pool): State<SqlitePool>,
    Path(run_id): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let (tx, rx) = tokio::sync::mpsc::channel::<RunEvent>(100);

    // Fetch run to get workflow_id and startup vars
    let run = sqlx::query_as::<_, (String, String, String)>(
        "SELECT workflow_id, startup_variable_values, status FROM workflow_runs WHERE id = ?"
    ).bind(&run_id).fetch_optional(&pool).await.unwrap();

    if let Some((workflow_id, vars_json, _)) = run {
        let startup_vars: HashMap<String, String> = serde_json::from_str(&vars_json).unwrap_or_default();
        let pool_clone = pool.clone();
        tokio::spawn(async move {
            run_workflow(&pool_clone, &workflow_id, startup_vars, tx).await;
        });
    }

    let stream = ReceiverStream::new(rx).map(|event| {
        let data = serde_json::to_string(&event).unwrap();
        Ok(Event::default().data(data))
    });

    Sse::new(stream)
}

async fn list_runs(State(pool): State<SqlitePool>, Path(wid): Path<String>) -> Json<Vec<serde_json::Value>> {
    let rows = sqlx::query_as::<_, (String, String, Option<String>, String)>(
        "SELECT id, started_at, finished_at, status FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC"
    ).bind(&wid).fetch_all(&pool).await.unwrap_or_default();
    Json(rows.into_iter().map(|(id, started, finished, status)| {
        serde_json::json!({ "id": id, "started_at": started, "finished_at": finished, "status": status })
    }).collect())
}

async fn get_run(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<serde_json::Value>, StatusCode> {
    sqlx::query_as::<_, (String, String, Option<String>, String, String, String)>(
        "SELECT id, started_at, finished_at, status, startup_variable_values, step_results FROM workflow_runs WHERE id = ?"
    ).bind(&id).fetch_optional(&pool).await.unwrap()
    .map(|(id, started, finished, status, vars, results)| Json(serde_json::json!({
        "id": id, "started_at": started, "finished_at": finished, "status": status,
        "startup_variable_values": serde_json::from_str::<serde_json::Value>(&vars).unwrap_or_default(),
        "step_results": serde_json::from_str::<serde_json::Value>(&results).unwrap_or_default(),
    })))
    .ok_or(StatusCode::NOT_FOUND)
}
```

**Step 2: Add `futures` and `tokio-stream` map to Cargo.toml**

```toml
futures = "0.3"
```

**Step 3: Compile check**

```bash
cd backend && cargo build
```
Expected: Clean build.

**Step 4: Commit**

```bash
git add backend/src/routes/ backend/Cargo.toml
git commit -m "feat: SSE run streaming and run history endpoints"
```

---

## Task 13: Projects Dashboard (Frontend)

**PR:** `feat/ui-projects-dashboard`

**Files:**
- Create: `frontend/src/api/projects.ts`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/components/ProjectCard.tsx`

**Step 1: Write `frontend/src/api/projects.ts`**

```ts
import { api } from './client'

export interface Project {
  id: string
  name: string
  description: string
  created_at: string
}

export const projectsApi = {
  list: () => api.get<Project[]>('/api/projects').then(r => r.data),
  create: (name: string, description?: string) =>
    api.post<Project>('/api/projects', { name, description }).then(r => r.data),
  delete: (id: string) => api.delete(`/api/projects/${id}`),
}
```

**Step 2: Write `frontend/src/components/ProjectCard.tsx`**

```tsx
interface Props {
  name: string
  description: string
  workflowCount?: number
  onClick: () => void
  onDelete: () => void
}

export function ProjectCard({ name, description, onClick, onDelete }: Props) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-gray-900">{name}</h3>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="text-gray-400 hover:text-red-500 text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

**Step 3: Write `frontend/src/pages/Dashboard.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../api/projects'
import { ProjectCard } from '../components/ProjectCard'

export default function Dashboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: () => projectsApi.create(name, desc),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowForm(false); setName(''); setDesc('') },
  })

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Conductor</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + New Project
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border p-6 mb-6">
            <h2 className="font-semibold mb-4">New Project</h2>
            <input
              className="w-full border rounded-lg px-3 py-2 mb-3"
              placeholder="Project name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 mb-4"
              placeholder="Description (optional)"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => createMutation.mutate()} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                Create
              </button>
              <button onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              name={p.name}
              description={p.description}
              onClick={() => navigate(`/projects/${p.id}`)}
              onDelete={() => deleteMutation.mutate(p.id)}
            />
          ))}
        </div>

        {projects.length === 0 && !showForm && (
          <p className="text-center text-gray-400 mt-16">No projects yet. Create one to get started.</p>
        )}
      </div>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: projects dashboard with create and delete"
```

---

## Task 14: Workflow List Page (Frontend)

**PR:** `feat/ui-workflow-list`

**Files:**
- Create: `frontend/src/api/workflows.ts`
- Create: `frontend/src/pages/ProjectPage.tsx`
- Modify: `frontend/src/main.tsx` (add route)

**Step 1: Write `frontend/src/api/workflows.ts`**

```ts
import { api } from './client'

export interface StartupVariable {
  name: string
  default_value: string
  description: string
}

export interface Workflow {
  id: string
  project_id: string
  name: string
  description: string
  startup_variables: string  // JSON string
  created_at: string
}

export const workflowsApi = {
  list: (projectId: string) =>
    api.get<Workflow[]>(`/api/projects/${projectId}/workflows`).then(r => r.data),
  create: (projectId: string, name: string, description?: string) =>
    api.post<Workflow>(`/api/projects/${projectId}/workflows`, { name, description }).then(r => r.data),
  get: (id: string) =>
    api.get<Workflow>(`/api/workflows/${id}`).then(r => r.data),
  delete: (id: string) => api.delete(`/api/workflows/${id}`),
}
```

**Step 2: Create `frontend/src/pages/ProjectPage.tsx`** — lists workflows, links to WorkflowEditor

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowsApi } from '../api/workflows'

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows', projectId],
    queryFn: () => workflowsApi.list(projectId!),
  })

  const createMutation = useMutation({
    mutationFn: () => workflowsApi.create(projectId!, name),
    onSuccess: (wf) => {
      qc.invalidateQueries({ queryKey: ['workflows', projectId] })
      navigate(`/projects/${projectId}/workflows/${wf.id}`)
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <button onClick={() => navigate('/')} className="text-gray-500 mb-6 hover:text-gray-900">
          ← Projects
        </button>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + New Workflow
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border p-6 mb-6">
            <input className="w-full border rounded-lg px-3 py-2 mb-4" placeholder="Workflow name" value={name} onChange={e => setName(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => createMutation.mutate()} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Create</button>
              <button onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2">Cancel</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {workflows.map(wf => (
            <div
              key={wf.id}
              onClick={() => navigate(`/projects/${projectId}/workflows/${wf.id}`)}
              className="bg-white rounded-xl border p-5 cursor-pointer hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-gray-900">{wf.name}</h3>
              {wf.description && <p className="text-sm text-gray-500">{wf.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Add route to `frontend/src/main.tsx`**

```tsx
import ProjectPage from './pages/ProjectPage'
// Add inside <Routes>:
<Route path="/projects/:projectId" element={<ProjectPage />} />
```

**Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: project page with workflow list"
```

---

## Task 15: Workflow Editor Canvas (Frontend)

**PR:** `feat/ui-workflow-editor`

**Files:**
- Create: `frontend/src/api/steps.ts`
- Create: `frontend/src/api/conditions.ts`
- Create: `frontend/src/components/StepCard.tsx`
- Create: `frontend/src/components/ConditionGate.tsx`
- Create: `frontend/src/components/StepConfigPanel.tsx`
- Modify: `frontend/src/pages/WorkflowEditor.tsx`

**Step 1: Write `frontend/src/api/steps.ts`**

```ts
import { api } from './client'

export interface Header { key: string; value: string }
export interface ResponseSchemaField { path: string; alias: string; field_type: string }

export interface Step {
  id: string; workflow_id: string; order_index: number; name: string
  method: string; url: string; headers: string; body: string
  response_schema: string; on_success: string; on_failure: string
}

export const stepsApi = {
  list: (workflowId: string) =>
    api.get<Step[]>(`/api/workflows/${workflowId}/steps`).then(r => r.data),
  create: (workflowId: string, name: string) =>
    api.post<Step>(`/api/workflows/${workflowId}/steps`, { name }).then(r => r.data),
  update: (id: string, data: Partial<Step>) =>
    api.put(`/api/steps/${id}`, data),
  delete: (id: string) => api.delete(`/api/steps/${id}`),
}
```

**Step 2: Write `frontend/src/api/conditions.ts`**

```ts
import { api } from './client'

export interface Condition {
  id: string; workflow_id: string; after_step_id: string; expression: string; action: string
}

export const conditionsApi = {
  create: (stepId: string, workflowId: string, expression: string, action?: string) =>
    api.post<Condition>(`/api/steps/${stepId}/condition`, { workflow_id: workflowId, expression, action }).then(r => r.data),
  update: (id: string, expression: string, action: string) =>
    api.put(`/api/conditions/${id}`, { expression, action }),
  delete: (id: string) => api.delete(`/api/conditions/${id}`),
}
```

**Step 3: Write `frontend/src/components/StepCard.tsx`**

```tsx
import { Step } from '../api/steps'

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  PATCH: 'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
}

interface Props {
  step: Step
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
}

export function StepCard({ step, isSelected, onClick, onDelete }: Props) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all ${
        isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2 py-1 rounded ${METHOD_COLORS[step.method] ?? 'bg-gray-100 text-gray-700'}`}>
            {step.method}
          </span>
          <div>
            <p className="font-medium text-gray-900 text-sm">{step.name}</p>
            {step.url && <p className="text-xs text-gray-400 truncate max-w-xs">{step.url}</p>}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="text-gray-300 hover:text-red-400 text-lg leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

**Step 4: Write `frontend/src/components/ConditionGate.tsx`**

```tsx
import { useState } from 'react'
import { Condition } from '../api/conditions'

interface Props {
  condition?: Condition
  onSave: (expression: string, action: string) => void
  onDelete?: () => void
}

export function ConditionGate({ condition, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [expr, setExpr] = useState(condition?.expression ?? '')
  const [action, setAction] = useState(condition?.action ?? 'FAIL')

  if (!condition && !editing) {
    return (
      <div className="flex items-center justify-center py-2">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-400 hover:text-blue-500 border border-dashed border-gray-300 rounded-full px-3 py-1"
        >
          + Add condition
        </button>
      </div>
    )
  }

  if (editing || condition) {
    return (
      <div className="flex items-center justify-center py-2">
        {editing ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm">
            <span className="text-amber-700 font-medium">if</span>
            <input
              className="border rounded px-2 py-1 text-xs w-48"
              placeholder="step1.amount == 0"
              value={expr}
              onChange={e => setExpr(e.target.value)}
            />
            <span className="text-amber-700">→</span>
            <select className="border rounded px-2 py-1 text-xs" value={action} onChange={e => setAction(e.target.value)}>
              <option value="FAIL">FAIL</option>
              <option value="STOP">STOP</option>
            </select>
            <button onClick={() => { onSave(expr, action); setEditing(false) }} className="bg-amber-500 text-white px-2 py-1 rounded text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="text-gray-400 text-xs">Cancel</button>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-amber-700">
            <span>if <code>{condition!.expression}</code> → {condition!.action}</span>
            <button onClick={() => setEditing(true)} className="text-amber-500 hover:text-amber-700">edit</button>
            <button onClick={onDelete} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
      </div>
    )
  }

  return null
}
```

**Step 5: Write `frontend/src/components/StepConfigPanel.tsx`** — full step editor

```tsx
import { useState, useEffect } from 'react'
import { Step } from '../api/steps'

interface Props {
  step: Step
  availableVars: string[]
  onSave: (updated: Partial<Step>) => void
}

export function StepConfigPanel({ step, availableVars, onSave }: Props) {
  const [name, setName] = useState(step.name)
  const [method, setMethod] = useState(step.method)
  const [url, setUrl] = useState(step.url)
  const [body, setBody] = useState(step.body)
  const [schema, setSchema] = useState(step.response_schema)

  useEffect(() => {
    setName(step.name); setMethod(step.method); setUrl(step.url)
    setBody(step.body); setSchema(step.response_schema)
  }, [step.id])

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <h3 className="font-semibold text-gray-900">Step Config</h3>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Step Name</label>
        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={name} onChange={e => setName(e.target.value)} />
      </div>

      <div className="flex gap-3">
        <div className="w-28">
          <label className="text-xs text-gray-500 block mb-1">Method</label>
          <select className="w-full border rounded-lg px-3 py-2 text-sm" value={method} onChange={e => setMethod(e.target.value)}>
            {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">URL</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="https://api.example.com/{{base_path}}/orders" value={url} onChange={e => setUrl(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Body (JSON)</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
          rows={5}
          placeholder={'{\n  "amount": "{{step1.amount}}"\n}'}
          value={body}
          onChange={e => setBody(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Response Schema (JSON path → alias)</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
          rows={4}
          placeholder={'[{"path": "result.token", "alias": "token", "field_type": "String"}]'}
          value={schema}
          onChange={e => setSchema(e.target.value)}
        />
      </div>

      {availableVars.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Available Variables</label>
          <div className="flex flex-wrap gap-2">
            {availableVars.map(v => (
              <span key={v} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-mono">{`{{${v}}}`}</span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => onSave({ name, method, url, body, response_schema: schema })}
        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
      >
        Save Step
      </button>
    </div>
  )
}
```

**Step 6: Write the full `frontend/src/pages/WorkflowEditor.tsx`**

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowsApi } from '../api/workflows'
import { stepsApi, Step } from '../api/steps'
import { conditionsApi, Condition } from '../api/conditions'
import { StepCard } from '../components/StepCard'
import { ConditionGate } from '../components/ConditionGate'
import { StepConfigPanel } from '../components/StepConfigPanel'

export default function WorkflowEditor() {
  const { projectId, workflowId } = useParams<{ projectId: string; workflowId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)

  const { data: workflow } = useQuery({ queryKey: ['workflow', workflowId], queryFn: () => workflowsApi.get(workflowId!) })
  const { data: steps = [] } = useQuery({ queryKey: ['steps', workflowId], queryFn: () => stepsApi.list(workflowId!) })

  const createStep = useMutation({
    mutationFn: () => stepsApi.create(workflowId!, `Step ${steps.length + 1}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', workflowId] }),
  })

  const deleteStep = useMutation({
    mutationFn: stepsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['steps', workflowId] }); setSelectedStep(null) },
  })

  const updateStep = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Step> }) => stepsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', workflowId] }),
  })

  const addCondition = useMutation({
    mutationFn: ({ stepId, expr, action }: { stepId: string; expr: string; action: string }) =>
      conditionsApi.create(stepId, workflowId!, expr, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conditions', workflowId] }),
  })

  const { data: conditions = [] } = useQuery<Condition[]>({
    queryKey: ['conditions', workflowId],
    queryFn: async () => {
      // fetch all conditions for this workflow by querying each step's condition
      return [] // populated via step results in full implementation
    },
  })

  // Build available variables list for a given step index
  const getAvailableVars = (stepIndex: number): string[] => {
    const startupVars = JSON.parse(workflow?.startup_variables ?? '[]')
      .map((v: { name: string }) => v.name)
    const stepVars: string[] = []
    for (let i = 0; i < stepIndex; i++) {
      const schema = JSON.parse(steps[i]?.response_schema ?? '[]')
      schema.forEach((f: { alias: string }) => stepVars.push(`step${i + 1}.${f.alias}`))
    }
    return [...startupVars, ...stepVars]
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="text-gray-500 hover:text-gray-900">←</button>
          <h1 className="font-semibold text-gray-900">{workflow?.name}</h1>
        </div>
        <button
          onClick={() => navigate(`/projects/${projectId}/workflows/${workflowId}/run`)}
          className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 font-medium"
        >
          ▶ Run
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-xl mx-auto space-y-2">
            {steps.map((step, idx) => (
              <div key={step.id}>
                <StepCard
                  step={step}
                  isSelected={selectedStep?.id === step.id}
                  onClick={() => setSelectedStep(step)}
                  onDelete={() => deleteStep.mutate(step.id)}
                />
                <ConditionGate
                  condition={conditions.find(c => c.after_step_id === step.id)}
                  onSave={(expr, action) => addCondition.mutate({ stepId: step.id, expr, action })}
                  onDelete={() => {}}
                />
                {/* Connector arrow */}
                {idx < steps.length - 1 && (
                  <div className="flex justify-center text-gray-300 text-xl py-1">↓</div>
                )}
              </div>
            ))}

            {/* Add step button */}
            <button
              onClick={() => createStep.mutate()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              + Add Step
            </button>
          </div>
        </div>

        {/* Config panel */}
        {selectedStep && (
          <div className="w-96 bg-white border-l overflow-hidden">
            <StepConfigPanel
              step={selectedStep}
              availableVars={getAvailableVars(steps.findIndex(s => s.id === selectedStep.id))}
              onSave={data => updateStep.mutate({ id: selectedStep.id, data })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: workflow editor canvas with step cards, condition gates, config panel"
```

---

## Task 16: Run View (Frontend)

**PR:** `feat/ui-run-view`

**Files:**
- Create: `frontend/src/api/runs.ts`
- Create: `frontend/src/pages/RunPage.tsx`
- Create: `frontend/src/components/RunStepCard.tsx`

**Step 1: Write `frontend/src/api/runs.ts`**

```ts
import { api } from './client'

export interface RunResult {
  id: string
  status: 'RUNNING' | 'PASSED' | 'FAILED'
  started_at: string
  finished_at?: string
  step_results: StepResult[]
  startup_variable_values: Record<string, string>
}

export interface StepResult {
  step_id: string
  status: 'passed' | 'failed'
  response_body: string
  extracted_vars: Record<string, string>
  error?: string
}

export const runsApi = {
  start: (workflowId: string, startupVars: Record<string, string>) =>
    api.post<{ run_id: string }>(`/api/workflows/${workflowId}/run`, {
      startup_variable_values: startupVars,
    }).then(r => r.data),
  get: (runId: string) =>
    api.get<RunResult>(`/api/runs/${runId}`).then(r => r.data),
  list: (workflowId: string) =>
    api.get<RunResult[]>(`/api/workflows/${workflowId}/runs`).then(r => r.data),
  streamUrl: (runId: string) =>
    `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/runs/${runId}/stream`,
}
```

**Step 2: Write `frontend/src/components/RunStepCard.tsx`**

```tsx
import { useState } from 'react'
import { StepResult } from '../api/runs'
import { Step } from '../api/steps'

interface Props {
  step: Step
  result?: StepResult
  status: 'pending' | 'running' | 'passed' | 'failed'
}

const STATUS_ICON = { pending: '⏳', running: '🔄', passed: '✅', failed: '❌' }
const STATUS_COLOR = {
  pending: 'border-gray-200',
  running: 'border-blue-300 bg-blue-50',
  passed: 'border-green-300 bg-green-50',
  failed: 'border-red-300 bg-red-50',
}

export function RunStepCard({ step, result, status }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${STATUS_COLOR[status]}`}>
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-3">
          <span>{STATUS_ICON[status]}</span>
          <div>
            <p className="font-medium text-sm text-gray-900">{step.name}</p>
            <p className="text-xs text-gray-500">{step.method} {step.url}</p>
          </div>
        </div>
        {result && <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>}
      </div>

      {expanded && result && (
        <div className="mt-4 space-y-3 text-xs font-mono">
          {result.error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700">
              Error: {result.error}
            </div>
          )}
          {result.response_body && (
            <div>
              <p className="text-gray-500 mb-1">Response:</p>
              <pre className="bg-gray-50 rounded p-2 overflow-x-auto text-gray-700">
                {JSON.stringify(JSON.parse(result.response_body || '{}'), null, 2)}
              </pre>
            </div>
          )}
          {Object.keys(result.extracted_vars).length > 0 && (
            <div>
              <p className="text-gray-500 mb-1">Extracted Variables:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.extracted_vars).map(([k, v]) => (
                  <span key={k} className="bg-white border rounded px-2 py-1">
                    <span className="text-blue-600">{k}</span> = <span className="text-gray-700">{v}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Write `frontend/src/pages/RunPage.tsx`** — SSE consumer

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { runsApi } from '../api/runs'
import { stepsApi, Step } from '../api/steps'
import { RunStepCard } from '../components/RunStepCard'

type StepStatus = 'pending' | 'running' | 'passed' | 'failed'

export default function RunPage() {
  const { workflowId, runId } = useParams<{ workflowId: string; runId: string }>()
  const navigate = useNavigate()
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({})
  const [stepResults, setStepResults] = useState<Record<string, any>>({})
  const [runStatus, setRunStatus] = useState<'running' | 'passed' | 'failed'>('running')

  const { data: steps = [] } = useQuery<Step[]>({
    queryKey: ['steps', workflowId],
    queryFn: () => stepsApi.list(workflowId!),
  })

  useEffect(() => {
    if (!runId) return
    const es = new EventSource(runsApi.streamUrl(runId))

    es.onmessage = (e) => {
      const event = JSON.parse(e.data)
      if (event.type === 'step_start') {
        setStepStatuses(s => ({ ...s, [event.step_id]: 'running' }))
      } else if (event.type === 'step_complete') {
        setStepStatuses(s => ({ ...s, [event.step_id]: 'passed' }))
        setStepResults(r => ({ ...r, [event.step_id]: { status: 'passed', extracted_vars: event.extracted } }))
      } else if (event.type === 'step_failed') {
        setStepStatuses(s => ({ ...s, [event.step_id]: 'failed' }))
        setStepResults(r => ({ ...r, [event.step_id]: { status: 'failed', error: event.error, response_body: event.response } }))
      } else if (event.type === 'run_complete') {
        setRunStatus(event.status)
        es.close()
      }
    }

    return () => es.close()
  }, [runId])

  const getStepStatus = (stepId: string): StepStatus =>
    stepStatuses[stepId] ?? 'pending'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-8">
        <button onClick={() => navigate(-1)} className="text-gray-500 mb-6 hover:text-gray-900">← Back</button>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Run</h1>
          <span className={`px-4 py-2 rounded-full font-medium text-sm ${
            runStatus === 'passed' ? 'bg-green-100 text-green-700' :
            runStatus === 'failed' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {runStatus.toUpperCase()}
          </span>
        </div>

        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={step.id}>
              <RunStepCard
                step={step}
                result={stepResults[step.id]}
                status={getStepStatus(step.id)}
              />
              {idx < steps.length - 1 && (
                <div className="flex justify-center text-gray-300 text-xl py-1">↓</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Add routes and run trigger to `frontend/src/main.tsx`**

```tsx
import RunPage from './pages/RunPage'
// Add inside <Routes>:
<Route path="/projects/:projectId/workflows/:workflowId/run-view/:runId" element={<RunPage />} />
```

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: live run view with SSE step status streaming"
```

---

## Task 17: Startup Variables + Run Trigger (Frontend)

**PR:** `feat/ui-run-trigger`

**Files:**
- Create: `frontend/src/components/StartupVarsModal.tsx`
- Modify: `frontend/src/pages/WorkflowEditor.tsx` (wire up Run button)

**Step 1: Write `frontend/src/components/StartupVarsModal.tsx`**

```tsx
import { useState } from 'react'
import { StartupVariable } from '../api/workflows'

interface Props {
  variables: StartupVariable[]
  onRun: (values: Record<string, string>) => void
  onClose: () => void
}

export function StartupVarsModal({ variables, onRun, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(variables.map(v => [v.name, v.default_value]))
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
        <h2 className="font-bold text-lg mb-6">Set Variables</h2>
        <div className="space-y-4">
          {variables.map(v => (
            <div key={v.name}>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                {v.name}
                {v.description && <span className="text-gray-400 font-normal ml-2">— {v.description}</span>}
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={values[v.name] ?? ''}
                onChange={e => setValues(prev => ({ ...prev, [v.name]: e.target.value }))}
              />
            </div>
          ))}
          {variables.length === 0 && (
            <p className="text-gray-500 text-sm">No startup variables defined for this workflow.</p>
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={() => onRun(values)} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700">
            Run Workflow
          </button>
          <button onClick={onClose} className="px-5 text-gray-500 hover:text-gray-900">Cancel</button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Wire Run button in `WorkflowEditor.tsx`** — show modal, call `runsApi.start`, navigate to RunPage

```tsx
// Add to WorkflowEditor.tsx:
import { StartupVarsModal } from '../components/StartupVarsModal'
import { runsApi } from '../api/runs'

// State:
const [showRunModal, setShowRunModal] = useState(false)

// Handler:
const handleRun = async (vars: Record<string, string>) => {
  const { run_id } = await runsApi.start(workflowId!, vars)
  navigate(`/projects/${projectId}/workflows/${workflowId}/run-view/${run_id}`)
}

// In JSX, replace Run button's onClick and add modal:
<button onClick={() => setShowRunModal(true)} ...>▶ Run</button>

{showRunModal && workflow && (
  <StartupVarsModal
    variables={JSON.parse(workflow.startup_variables ?? '[]')}
    onRun={vars => { setShowRunModal(false); handleRun(vars) }}
    onClose={() => setShowRunModal(false)}
  />
)}
```

**Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat: startup variables modal and run trigger"
```

---

## Task 18: Run History (Frontend)

**PR:** `feat/ui-run-history`

**Files:**
- Create: `frontend/src/components/RunHistory.tsx`
- Modify: `frontend/src/pages/WorkflowEditor.tsx` (add history sidebar)

**Step 1: Write `frontend/src/components/RunHistory.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { runsApi } from '../api/runs'

export function RunHistory() {
  const { workflowId, projectId } = useParams<{ workflowId: string; projectId: string }>()
  const navigate = useNavigate()

  const { data: runs = [] } = useQuery({
    queryKey: ['runs', workflowId],
    queryFn: () => runsApi.list(workflowId!),
    refetchInterval: 5000,
  })

  return (
    <div className="w-72 bg-white border-l overflow-y-auto">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm text-gray-700">Run History</h3>
      </div>
      <div className="divide-y">
        {runs.map(run => (
          <div
            key={run.id}
            onClick={() => navigate(`/projects/${projectId}/workflows/${workflowId}/run-view/${run.id}`)}
            className="p-4 cursor-pointer hover:bg-gray-50"
          >
            <div className="flex justify-between items-center">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                run.status === 'PASSED' ? 'bg-green-100 text-green-700' :
                run.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {run.status}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(run.started_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        {runs.length === 0 && (
          <p className="p-4 text-xs text-gray-400">No runs yet</p>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Add `RunHistory` to WorkflowEditor layout** — after the config panel in the flex row

**Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat: run history sidebar with live status"
```

---

## Summary: PR Order

| # | PR Branch | What Ships |
|---|-----------|------------|
| 1 | `feat/backend-scaffold` | Axum + sqlx app skeleton |
| 2 | `feat/frontend-scaffold` | React + Vite + Tailwind skeleton |
| 3 | `feat/docker-compose` | One-command self-host |
| 4 | `feat/db-migrations` | All SQLite tables |
| 5 | `feat/projects-api` | Projects CRUD |
| 6 | `feat/workflows-api` | Workflows CRUD |
| 7 | `feat/steps-api` | Steps CRUD + reorder |
| 8 | `feat/conditions-api` | Conditions CRUD |
| 9 | `feat/variable-interpolation` | `{{varName}}` engine |
| 10 | `feat/condition-evaluator` | Expression evaluator |
| 11 | `feat/execution-engine` | Core workflow runner |
| 12 | `feat/sse-streaming` | Real-time run streaming |
| 13 | `feat/ui-projects-dashboard` | Projects list UI |
| 14 | `feat/ui-workflow-list` | Workflows list UI |
| 15 | `feat/ui-workflow-editor` | Step canvas + config panel |
| 16 | `feat/ui-run-view` | Live run view (SSE) |
| 17 | `feat/ui-run-trigger` | Startup vars modal + run button |
| 18 | `feat/ui-run-history` | Run history sidebar |
