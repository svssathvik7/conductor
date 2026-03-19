use axum::Router;
use sqlx::SqlitePool;

mod conditions;
mod projects;
mod steps;
mod workflows;

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .merge(conditions::router())
        .merge(projects::router())
        .merge(steps::router())
        .merge(workflows::router())
}
