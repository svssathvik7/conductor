use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Condition {
    pub id: String,
    pub workflow_id: String,
    pub after_step_id: String,
    pub expression: String,
    pub action: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCondition {
    pub workflow_id: String,
    pub expression: String,
    pub action: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCondition {
    pub expression: String,
    pub action: String,
}

impl Condition {
    pub fn new(after_step_id: String, workflow_id: String, expression: String, action: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            workflow_id,
            after_step_id,
            expression,
            action,
        }
    }
}
