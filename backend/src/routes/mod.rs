use axum::Router;
use sqlx::SqlitePool;

mod projects;

pub fn router() -> Router<SqlitePool> {
    Router::new().merge(projects::router())
}
