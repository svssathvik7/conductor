use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use sqlx::SqlitePool;
use crate::models::workflow::{CreateWorkflow, UpdateWorkflow, Workflow};

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route(
            "/projects/:project_id/workflows",
            get(list_workflows).post(create_workflow),
        )
        .route(
            "/workflows/:id",
            get(get_workflow).put(update_workflow).delete(delete_workflow),
        )
}

async fn list_workflows(
    State(pool): State<SqlitePool>,
    Path(project_id): Path<String>,
) -> Json<Vec<Workflow>> {
    let workflows = sqlx::query_as::<_, Workflow>(
        "SELECT * FROM workflows WHERE project_id = ? ORDER BY created_at DESC",
    )
    .bind(&project_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(workflows)
}

pub async fn get_workflow(
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
        "INSERT INTO workflows (id, project_id, name, description, startup_variables, created_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&workflow.id)
    .bind(&workflow.project_id)
    .bind(&workflow.name)
    .bind(&workflow.description)
    .bind(&workflow.startup_variables)
    .bind(&workflow.created_at)
    .execute(&pool)
    .await
    .unwrap();
    (StatusCode::CREATED, Json(workflow))
}

async fn update_workflow(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateWorkflow>,
) -> Result<Json<Workflow>, StatusCode> {
    // Fetch current workflow first
    let current = sqlx::query_as::<_, Workflow>("SELECT * FROM workflows WHERE id = ?")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .unwrap()
        .ok_or(StatusCode::NOT_FOUND)?;

    let new_name = payload.name.unwrap_or(current.name);
    let new_desc = payload.description.unwrap_or(current.description);
    let new_vars = match payload.startup_variables {
        Some(vars) => serde_json::to_string(&vars).unwrap_or_else(|_| "[]".to_string()),
        None => current.startup_variables,
    };

    sqlx::query(
        "UPDATE workflows SET name = ?, description = ?, startup_variables = ? WHERE id = ?",
    )
    .bind(&new_name)
    .bind(&new_desc)
    .bind(&new_vars)
    .bind(&id)
    .execute(&pool)
    .await
    .unwrap();

    get_workflow(State(pool), Path(id)).await
}

async fn delete_workflow(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> StatusCode {
    sqlx::query("DELETE FROM workflows WHERE id = ?")
        .bind(&id)
        .execute(&pool)
        .await
        .unwrap();
    StatusCode::NO_CONTENT
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
        // Seed a project (workflows require a valid project_id FK)
        sqlx::query(
            "INSERT INTO projects (id, name, description, created_at) VALUES ('p1', 'Test', '', '2024-01-01T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_and_list_workflow() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server
            .post("/api/projects/p1/workflows")
            .json(&serde_json::json!({"name": "Happy Flow"}))
            .await;
        res.assert_status(StatusCode::CREATED);
        let wf: Workflow = res.json();
        assert_eq!(wf.name, "Happy Flow");
        assert_eq!(wf.project_id, "p1");

        let res = server.get("/api/projects/p1/workflows").await;
        res.assert_status_ok();
        let workflows: Vec<Workflow> = res.json();
        assert_eq!(workflows.len(), 1);
    }

    #[tokio::test]
    async fn test_get_workflow() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server
            .post("/api/projects/p1/workflows")
            .json(&serde_json::json!({"name": "Order Test"}))
            .await;
        let wf: Workflow = res.json();

        let res = server.get(&format!("/api/workflows/{}", wf.id)).await;
        res.assert_status_ok();
        let fetched: Workflow = res.json();
        assert_eq!(fetched.id, wf.id);
        assert_eq!(fetched.name, "Order Test");
    }

    #[tokio::test]
    async fn test_update_workflow() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server
            .post("/api/projects/p1/workflows")
            .json(&serde_json::json!({"name": "Old Name"}))
            .await;
        let wf: Workflow = res.json();

        let res = server
            .put(&format!("/api/workflows/{}", wf.id))
            .json(&serde_json::json!({"name": "New Name"}))
            .await;
        res.assert_status_ok();
        let updated: Workflow = res.json();
        assert_eq!(updated.name, "New Name");
    }
}
