use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get},
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
    let projects = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(projects)
}

async fn create_project(
    State(pool): State<SqlitePool>,
    Json(payload): Json<CreateProject>,
) -> (StatusCode, Json<Project>) {
    let project = Project::new(
        payload.name,
        payload.description.unwrap_or_default(),
    );
    sqlx::query(
        "INSERT INTO projects (id, name, description, created_at) VALUES (?, ?, ?, ?)"
    )
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
        let app = Router::new()
            .nest("/api", router())
            .with_state(pool);
        let server = TestServer::new(app).unwrap();

        // Create a project
        let res = server
            .post("/api/projects")
            .json(&serde_json::json!({"name": "Test Project", "description": "Test desc"}))
            .await;
        res.assert_status(StatusCode::CREATED);
        let project: Project = res.json();
        assert_eq!(project.name, "Test Project");
        assert_eq!(project.description, "Test desc");
        assert!(!project.id.is_empty());

        // List projects
        let res = server.get("/api/projects").await;
        res.assert_status_ok();
        let projects: Vec<Project> = res.json();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].name, "Test Project");
    }

    #[tokio::test]
    async fn test_delete_project() {
        let pool = test_pool().await;
        let app = Router::new()
            .nest("/api", router())
            .with_state(pool);
        let server = TestServer::new(app).unwrap();

        // Create then delete
        let res = server
            .post("/api/projects")
            .json(&serde_json::json!({"name": "To Delete"}))
            .await;
        let project: Project = res.json();

        let res = server.delete(&format!("/api/projects/{}", project.id)).await;
        res.assert_status(StatusCode::NO_CONTENT);

        // List should be empty
        let res = server.get("/api/projects").await;
        let projects: Vec<Project> = res.json();
        assert_eq!(projects.len(), 0);
    }
}
