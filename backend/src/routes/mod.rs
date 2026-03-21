use axum::Router;
use sqlx::SqlitePool;

mod conditions;
mod profiles;
mod projects;
mod runs;
mod steps;
mod workflows;

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .merge(conditions::router())
        .merge(profiles::router())
        .merge(projects::router())
        .merge(runs::router())
        .merge(steps::router())
        .merge(workflows::router())
}
