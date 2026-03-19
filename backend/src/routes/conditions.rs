use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post, put},
    Json, Router,
};
use sqlx::SqlitePool;
use crate::models::condition::{Condition, CreateCondition, UpdateCondition};

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route("/steps/:step_id/condition", post(create_condition))
        .route("/workflows/:workflow_id/conditions", get(list_conditions))
        .route("/conditions/:id", put(update_condition).delete(delete_condition))
}

async fn list_conditions(
    State(pool): State<SqlitePool>,
    Path(workflow_id): Path<String>,
) -> Json<Vec<Condition>> {
    let conditions = sqlx::query_as::<_, Condition>(
        "SELECT * FROM conditions WHERE workflow_id = ?"
    )
    .bind(&workflow_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(conditions)
}

async fn create_condition(
    State(pool): State<SqlitePool>,
    Path(step_id): Path<String>,
    Json(payload): Json<CreateCondition>,
) -> (StatusCode, Json<Condition>) {
    let condition = Condition::new(
        step_id,
        payload.workflow_id,
        payload.expression,
        payload.action.unwrap_or_else(|| "FAIL".to_string()),
    );
    sqlx::query(
        "INSERT INTO conditions (id, workflow_id, after_step_id, expression, action) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&condition.id)
    .bind(&condition.workflow_id)
    .bind(&condition.after_step_id)
    .bind(&condition.expression)
    .bind(&condition.action)
    .execute(&pool)
    .await
    .unwrap();
    (StatusCode::CREATED, Json(condition))
}

async fn update_condition(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateCondition>,
) -> StatusCode {
    sqlx::query("UPDATE conditions SET expression=?, action=? WHERE id=?")
        .bind(&payload.expression)
        .bind(&payload.action)
        .bind(&id)
        .execute(&pool)
        .await
        .unwrap();
    StatusCode::OK
}

async fn delete_condition(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> StatusCode {
    sqlx::query("DELETE FROM conditions WHERE id=?")
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
        sqlx::query("INSERT INTO projects (id,name,description,created_at) VALUES ('p1','P','','2024-01-01T00:00:00Z')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO workflows (id,project_id,name,description,startup_variables,created_at) VALUES ('w1','p1','W','','[]','2024-01-01T00:00:00Z')")
            .execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO steps (id,workflow_id,order_index,name,method,url,headers,body,response_schema,on_success,on_failure) VALUES ('s1','w1',0,'S1','GET','','[]','','[]','CONTINUE','STOP')")
            .execute(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_create_and_list_condition() {
        let pool = test_pool().await;
        let app = Router::new().nest("/api", router()).with_state(pool);
        let server = TestServer::new(app).unwrap();

        let res = server
            .post("/api/steps/s1/condition")
            .json(&serde_json::json!({"workflow_id": "w1", "expression": "step1.amount == 0", "action": "FAIL"}))
            .await;
        res.assert_status(StatusCode::CREATED);
        let cond: Condition = res.json();
        assert_eq!(cond.expression, "step1.amount == 0");
        assert_eq!(cond.action, "FAIL");

        let res = server.get("/api/workflows/w1/conditions").await;
        let conditions: Vec<Condition> = res.json();
        assert_eq!(conditions.len(), 1);
    }
}
