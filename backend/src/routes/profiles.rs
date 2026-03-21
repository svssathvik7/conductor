use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use sqlx::SqlitePool;
use crate::models::profile::{CreateProfile, EnvironmentProfile, UpdateProfile};

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route(
            "/workflows/:workflow_id/profiles",
            get(list_profiles).post(create_profile),
        )
        .route(
            "/profiles/:id",
            get(get_profile).put(update_profile).delete(delete_profile),
        )
}

async fn list_profiles(
    State(pool): State<SqlitePool>,
    Path(workflow_id): Path<String>,
) -> Json<Vec<EnvironmentProfile>> {
    let profiles = sqlx::query_as::<_, EnvironmentProfile>(
        "SELECT * FROM environment_profiles WHERE workflow_id = ? ORDER BY created_at ASC",
    )
    .bind(&workflow_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(profiles)
}

async fn get_profile(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<EnvironmentProfile>, StatusCode> {
    sqlx::query_as::<_, EnvironmentProfile>(
        "SELECT * FROM environment_profiles WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await
    .unwrap()
    .map(Json)
    .ok_or(StatusCode::NOT_FOUND)
}

async fn create_profile(
    State(pool): State<SqlitePool>,
    Path(workflow_id): Path<String>,
    Json(payload): Json<CreateProfile>,
) -> (StatusCode, Json<EnvironmentProfile>) {
    let profile = EnvironmentProfile::new(
        workflow_id,
        payload.name,
        payload.variables.unwrap_or_default(),
    );
    sqlx::query(
        "INSERT INTO environment_profiles (id, workflow_id, name, variables, created_at) \
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&profile.id)
    .bind(&profile.workflow_id)
    .bind(&profile.name)
    .bind(&profile.variables)
    .bind(&profile.created_at)
    .execute(&pool)
    .await
    .unwrap();
    (StatusCode::CREATED, Json(profile))
}

async fn update_profile(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateProfile>,
) -> Result<Json<EnvironmentProfile>, StatusCode> {
    let current = sqlx::query_as::<_, EnvironmentProfile>(
        "SELECT * FROM environment_profiles WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await
    .unwrap()
    .ok_or(StatusCode::NOT_FOUND)?;

    let new_name = payload.name.unwrap_or(current.name);
    let new_vars = match payload.variables {
        Some(vars) => serde_json::to_string(&vars).unwrap_or_else(|_| "{}".to_string()),
        None => current.variables,
    };

    sqlx::query(
        "UPDATE environment_profiles SET name = ?, variables = ? WHERE id = ?",
    )
    .bind(&new_name)
    .bind(&new_vars)
    .bind(&id)
    .execute(&pool)
    .await
    .unwrap();

    let updated = sqlx::query_as::<_, EnvironmentProfile>(
        "SELECT * FROM environment_profiles WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&pool)
    .await
    .unwrap();
    Ok(Json(updated))
}

async fn delete_profile(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> StatusCode {
    sqlx::query("DELETE FROM environment_profiles WHERE id = ?")
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
    use std::collections::HashMap;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO projects (id, name, description, created_at) VALUES ('p1', 'Test', '', '2024-01-01T00:00:00Z')",
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
    async fn test_create_and_list_profiles() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        // Create a profile
        let mut vars = HashMap::new();
        vars.insert("base_url".to_string(), "https://dev.api.com".to_string());
        vars.insert("token".to_string(), "dev-token-123".to_string());

        let res = server
            .post("/api/workflows/w1/profiles")
            .json(&serde_json::json!({ "name": "dev", "variables": vars }))
            .await;
        res.assert_status(StatusCode::CREATED);
        let profile: EnvironmentProfile = res.json();
        assert_eq!(profile.name, "dev");
        assert_eq!(profile.workflow_id, "w1");

        let parsed_vars: HashMap<String, String> =
            serde_json::from_str(&profile.variables).unwrap();
        assert_eq!(parsed_vars.get("base_url").unwrap(), "https://dev.api.com");

        // Create another profile
        let res = server
            .post("/api/workflows/w1/profiles")
            .json(&serde_json::json!({ "name": "staging" }))
            .await;
        res.assert_status(StatusCode::CREATED);

        // List profiles
        let res = server.get("/api/workflows/w1/profiles").await;
        res.assert_status_ok();
        let profiles: Vec<EnvironmentProfile> = res.json();
        assert_eq!(profiles.len(), 2);
    }

    #[tokio::test]
    async fn test_update_profile() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server
            .post("/api/workflows/w1/profiles")
            .json(&serde_json::json!({ "name": "dev" }))
            .await;
        let profile: EnvironmentProfile = res.json();

        let mut new_vars = HashMap::new();
        new_vars.insert("base_url".to_string(), "https://staging.api.com".to_string());

        let res = server
            .put(&format!("/api/profiles/{}", profile.id))
            .json(&serde_json::json!({ "name": "staging", "variables": new_vars }))
            .await;
        res.assert_status_ok();
        let updated: EnvironmentProfile = res.json();
        assert_eq!(updated.name, "staging");
        let parsed: HashMap<String, String> =
            serde_json::from_str(&updated.variables).unwrap();
        assert_eq!(parsed.get("base_url").unwrap(), "https://staging.api.com");
    }

    #[tokio::test]
    async fn test_delete_profile() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server
            .post("/api/workflows/w1/profiles")
            .json(&serde_json::json!({ "name": "temp" }))
            .await;
        let profile: EnvironmentProfile = res.json();

        let res = server.delete(&format!("/api/profiles/{}", profile.id)).await;
        res.assert_status(StatusCode::NO_CONTENT);

        let res = server.get("/api/workflows/w1/profiles").await;
        let profiles: Vec<EnvironmentProfile> = res.json();
        assert_eq!(profiles.len(), 0);
    }
}
