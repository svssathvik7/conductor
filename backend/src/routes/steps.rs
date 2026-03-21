use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch, put},
    Json, Router,
};
use sqlx::SqlitePool;
use crate::models::step::{CreateStep, Step};

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route(
            "/workflows/:workflow_id/steps",
            get(list_steps).post(create_step),
        )
        .route("/steps/:id", put(update_step).delete(delete_step))
        .route("/steps/:id/reorder", patch(reorder_step))
}

async fn list_steps(
    State(pool): State<SqlitePool>,
    Path(workflow_id): Path<String>,
) -> Json<Vec<Step>> {
    let steps = sqlx::query_as::<_, Step>(
        "SELECT * FROM steps WHERE workflow_id = ? ORDER BY order_index ASC",
    )
    .bind(&workflow_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(steps)
}

async fn create_step(
    State(pool): State<SqlitePool>,
    Path(workflow_id): Path<String>,
    Json(payload): Json<CreateStep>,
) -> (StatusCode, Json<Step>) {
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM steps WHERE workflow_id = ?")
            .bind(&workflow_id)
            .fetch_one(&pool)
            .await
            .unwrap_or(0);

    let step = Step::new(workflow_id, count, payload);
    sqlx::query(
        "INSERT INTO steps \
         (id, workflow_id, order_index, name, method, url, headers, body, response_schema, on_success, on_failure, loop_type, loop_config) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&step.id)
    .bind(&step.workflow_id)
    .bind(step.order_index)
    .bind(&step.name)
    .bind(&step.method)
    .bind(&step.url)
    .bind(&step.headers)
    .bind(&step.body)
    .bind(&step.response_schema)
    .bind(&step.on_success)
    .bind(&step.on_failure)
    .bind(&step.loop_type)
    .bind(&step.loop_config)
    .execute(&pool)
    .await
    .unwrap();
    (StatusCode::CREATED, Json(step))
}

async fn update_step(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<CreateStep>,
) -> StatusCode {
    let headers = serde_json::to_string(&payload.headers.unwrap_or_default())
        .unwrap_or_else(|_| "[]".to_string());
    let schema = serde_json::to_string(&payload.response_schema.unwrap_or_default())
        .unwrap_or_else(|_| "[]".to_string());
    let loop_type = payload.loop_type.unwrap_or_else(|| "none".to_string());
    let loop_config = payload.loop_config.unwrap_or_else(|| "{}".to_string());
    sqlx::query(
        "UPDATE steps SET name=?, method=?, url=?, headers=?, body=?, response_schema=?, on_success=?, on_failure=?, loop_type=?, loop_config=? WHERE id=?",
    )
    .bind(&payload.name)
    .bind(payload.method.unwrap_or_else(|| "GET".to_string()))
    .bind(payload.url.unwrap_or_default())
    .bind(headers)
    .bind(payload.body.unwrap_or_default())
    .bind(schema)
    .bind(payload.on_success.unwrap_or_else(|| "CONTINUE".to_string()))
    .bind(payload.on_failure.unwrap_or_else(|| "STOP".to_string()))
    .bind(loop_type)
    .bind(loop_config)
    .bind(&id)
    .execute(&pool)
    .await
    .unwrap();
    StatusCode::OK
}

async fn delete_step(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> StatusCode {
    sqlx::query("DELETE FROM steps WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .unwrap();
    StatusCode::NO_CONTENT
}

#[derive(serde::Deserialize)]
struct ReorderPayload {
    new_index: i64,
}

async fn reorder_step(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<ReorderPayload>,
) -> StatusCode {
    sqlx::query("UPDATE steps SET order_index = ? WHERE id = ?")
        .bind(payload.new_index)
        .bind(&id)
        .execute(&pool)
        .await
        .unwrap();
    StatusCode::OK
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
        sqlx::query(
            "INSERT INTO projects (id, name, description, created_at) VALUES ('p1', 'P', '', '2024-01-01T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO workflows (id, project_id, name, description, startup_variables, created_at) \
             VALUES ('w1', 'p1', 'W', '', '[]', '2024-01-01T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_step_assigns_order() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server
            .post("/api/workflows/w1/steps")
            .json(&serde_json::json!({"name": "Step 1", "method": "POST", "url": "https://api.example.com/auth"}))
            .await;
        res.assert_status(StatusCode::CREATED);
        let step: Step = res.json();
        assert_eq!(step.name, "Step 1");
        assert_eq!(step.order_index, 0);

        // Second step should get order_index 1
        let res = server
            .post("/api/workflows/w1/steps")
            .json(&serde_json::json!({"name": "Step 2", "method": "GET", "url": "https://api.example.com/data"}))
            .await;
        let step2: Step = res.json();
        assert_eq!(step2.order_index, 1);
    }

    #[tokio::test]
    async fn test_list_steps_ordered() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        server.post("/api/workflows/w1/steps")
            .json(&serde_json::json!({"name": "First"})).await;
        server.post("/api/workflows/w1/steps")
            .json(&serde_json::json!({"name": "Second"})).await;

        let res = server.get("/api/workflows/w1/steps").await;
        res.assert_status_ok();
        let steps: Vec<Step> = res.json();
        assert_eq!(steps.len(), 2);
        assert_eq!(steps[0].name, "First");
        assert_eq!(steps[1].name, "Second");
    }

    #[tokio::test]
    async fn test_reorder_step() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server.post("/api/workflows/w1/steps")
            .json(&serde_json::json!({"name": "Step"})).await;
        let step: Step = res.json();

        let res = server
            .patch(&format!("/api/steps/{}/reorder", step.id))
            .json(&serde_json::json!({"new_index": 5}))
            .await;
        res.assert_status_ok();
    }

    #[tokio::test]
    async fn test_create_step_with_loop() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server
            .post("/api/workflows/w1/steps")
            .json(&serde_json::json!({
                "name": "Loop Step",
                "method": "GET",
                "url": "https://api.example.com/items",
                "loop_type": "count",
                "loop_config": "{\"count\": 3}"
            }))
            .await;
        res.assert_status(StatusCode::CREATED);
        let step: Step = res.json();
        assert_eq!(step.loop_type, "count");
        let config: serde_json::Value = serde_json::from_str(&step.loop_config).unwrap();
        assert_eq!(config["count"], 3);
    }

    #[tokio::test]
    async fn test_update_step_with_loop() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server
            .post("/api/workflows/w1/steps")
            .json(&serde_json::json!({"name": "Step"}))
            .await;
        let step: Step = res.json();
        assert_eq!(step.loop_type, "none");

        let res = server
            .put(&format!("/api/steps/{}", step.id))
            .json(&serde_json::json!({
                "name": "Loop Step",
                "loop_type": "for_each",
                "loop_config": "{\"source_var\": \"step1.items\"}"
            }))
            .await;
        res.assert_status_ok();
    }
}
