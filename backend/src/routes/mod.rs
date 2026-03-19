use axum::Router;
use sqlx::SqlitePool;

pub fn router() -> Router<SqlitePool> {
    Router::new()
}
