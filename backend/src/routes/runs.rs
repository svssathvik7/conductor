use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::sse::{Event, Sse},
    routing::{get, post},
    Json, Router,
};
use futures::stream::StreamExt;
use serde_json::Value;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::convert::Infallible;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use uuid::Uuid;
use chrono::Utc;
use crate::engine::runner::{run_workflow, RunEvent};
use crate::models::workflow::StartupVariable;

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
    pub profile_id: Option<String>,
}

/// Creates the run record and returns a run_id.
/// Execution is deferred to stream_run so events can be streamed in real time.
///
/// Variable merge order:
/// 1. Workflow startup variable defaults
/// 2. Profile variables (if profile_id provided)
/// 3. Explicit startup_variable_values overrides
async fn start_run(
    State(pool): State<SqlitePool>,
    Path(workflow_id): Path<String>,
    Json(payload): Json<StartRunPayload>,
) -> (StatusCode, Json<Value>) {
    let run_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();

    let mut final_vars: HashMap<String, String> = HashMap::new();

    // 1. Load workflow startup variable defaults
    let workflow_row = sqlx::query_as::<_, (String,)>(
        "SELECT startup_variables FROM workflows WHERE id = ?",
    )
    .bind(&workflow_id)
    .fetch_optional(&pool)
    .await
    .unwrap();

    if let Some((sv_json,)) = workflow_row {
        let defaults: Vec<StartupVariable> =
            serde_json::from_str(&sv_json).unwrap_or_default();
        for sv in &defaults {
            final_vars.insert(sv.name.clone(), sv.default_value.clone());
        }
    }

    // 2. Merge profile variables if profile_id provided
    if let Some(ref pid) = payload.profile_id {
        let profile = sqlx::query_as::<_, (String,)>(
            "SELECT variables FROM environment_profiles WHERE id = ?",
        )
        .bind(pid)
        .fetch_optional(&pool)
        .await
        .unwrap();
        if let Some((vars_json,)) = profile {
            let profile_vars: HashMap<String, String> =
                serde_json::from_str(&vars_json).unwrap_or_default();
            final_vars.extend(profile_vars);
        }
    }

    // 3. Merge explicit overrides
    if let Some(overrides) = payload.startup_variable_values {
        final_vars.extend(overrides);
    }

    let vars_json = serde_json::to_string(&final_vars).unwrap_or_else(|_| "{}".to_string());

    sqlx::query(
        "INSERT INTO workflow_runs (id, workflow_id, started_at, status, startup_variable_values, step_results) \
         VALUES (?, ?, ?, 'RUNNING', ?, '[]')",
    )
    .bind(&run_id)
    .bind(&workflow_id)
    .bind(&started_at)
    .bind(&vars_json)
    .execute(&pool)
    .await
    .unwrap();

    (StatusCode::CREATED, Json(serde_json::json!({ "run_id": run_id })))
}

/// SSE endpoint: executes the workflow and streams RunEvents in real time.
/// Also updates the DB record with final status and step_results on completion.
async fn stream_run(
    State(pool): State<SqlitePool>,
    Path(run_id): Path<String>,
) -> Sse<impl futures::stream::Stream<Item = Result<Event, Infallible>>> {
    let (tx, rx) = mpsc::channel::<RunEvent>(100);

    let run_row = sqlx::query_as::<_, (String, String, String)>(
        "SELECT workflow_id, startup_variable_values, status FROM workflow_runs WHERE id = ?",
    )
    .bind(&run_id)
    .fetch_optional(&pool)
    .await
    .unwrap();

    if let Some((workflow_id, vars_json, _status)) = run_row {
        let startup_vars: HashMap<String, String> =
            serde_json::from_str(&vars_json).unwrap_or_default();
        let pool_clone = pool.clone();
        let run_id_clone = run_id.clone();

        tokio::spawn(async move {
            let (results, run_status) = run_workflow(&pool_clone, &workflow_id, startup_vars, tx).await;
            // Persist final results
            let results_json = serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string());
            let final_status = run_status.to_uppercase();
            let finished_at = Utc::now().to_rfc3339();
            sqlx::query(
                "UPDATE workflow_runs SET status=?, finished_at=?, step_results=? WHERE id=?",
            )
            .bind(final_status)
            .bind(finished_at)
            .bind(results_json)
            .bind(&run_id_clone)
            .execute(&pool_clone)
            .await
            .unwrap();
        });
    }

    let stream = ReceiverStream::new(rx).map(|event| {
        let data = serde_json::to_string(&event).unwrap_or_else(|_| "{}".to_string());
        Ok::<Event, Infallible>(Event::default().data(data))
    });

    Sse::new(stream)
}

async fn list_runs(
    State(pool): State<SqlitePool>,
    Path(workflow_id): Path<String>,
) -> Json<Vec<Value>> {
    let rows = sqlx::query_as::<_, (String, String, Option<String>, String)>(
        "SELECT id, started_at, finished_at, status FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC",
    )
    .bind(&workflow_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let runs = rows
        .into_iter()
        .map(|(id, started, finished, status)| {
            serde_json::json!({
                "id": id,
                "started_at": started,
                "finished_at": finished,
                "status": status,
            })
        })
        .collect();
    Json(runs)
}

async fn get_run(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    sqlx::query_as::<_, (String, String, Option<String>, String, String, String)>(
        "SELECT id, started_at, finished_at, status, startup_variable_values, step_results \
         FROM workflow_runs WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await
    .unwrap()
    .map(|(id, started, finished, status, vars, results)| {
        Json(serde_json::json!({
            "id": id,
            "started_at": started,
            "finished_at": finished,
            "status": status,
            "startup_variable_values": serde_json::from_str::<Value>(&vars).unwrap_or_default(),
            "step_results": serde_json::from_str::<Value>(&results).unwrap_or_default(),
        }))
    })
    .ok_or(StatusCode::NOT_FOUND)
}

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
        sqlx::query("INSERT INTO projects (id,name,description,created_at) VALUES ('p1','P','','2024-01-01T00:00:00Z')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO workflows (id,project_id,name,description,startup_variables,created_at) VALUES ('w1','p1','W','','[]','2024-01-01T00:00:00Z')")
            .execute(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_start_run_only_creates_record() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool.clone());
        let server = TestServer::new(app).unwrap();

        let res = server
            .post("/api/workflows/w1/run")
            .json(&serde_json::json!({"startup_variable_values": {}}))
            .await;
        res.assert_status(StatusCode::CREATED);
        let body: Value = res.json();
        let run_id = body["run_id"].as_str().unwrap().to_string();
        assert!(!run_id.is_empty());

        // Run record should exist with RUNNING status (no execution started yet)
        let run_row: Option<(String,)> = sqlx::query_as(
            "SELECT status FROM workflow_runs WHERE id = ?"
        )
        .bind(&run_id)
        .fetch_optional(&pool)
        .await
        .unwrap();
        assert!(run_row.is_some());
        assert_eq!(run_row.unwrap().0, "RUNNING");
    }

    #[tokio::test]
    async fn test_list_runs() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool.clone());
        let server = TestServer::new(app).unwrap();

        server.post("/api/workflows/w1/run")
            .json(&serde_json::json!({})).await;
        server.post("/api/workflows/w1/run")
            .json(&serde_json::json!({})).await;

        let res = server.get("/api/workflows/w1/runs").await;
        res.assert_status_ok();
        let runs: Vec<Value> = res.json();
        assert_eq!(runs.len(), 2);
    }
}
