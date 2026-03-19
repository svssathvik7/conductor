use axum::Router;
use sqlx::SqlitePool;

mod projects;
mod workflows;

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .merge(projects::router())
        .merge(workflows::router())
}
