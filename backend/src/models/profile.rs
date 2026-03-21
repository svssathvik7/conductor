use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct EnvironmentProfile {
    pub id: String,
    pub workflow_id: String,
    pub name: String,
    pub variables: String, // JSON string of HashMap<String, String>
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProfile {
    pub name: String,
    pub variables: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfile {
    pub name: Option<String>,
    pub variables: Option<std::collections::HashMap<String, String>>,
}

impl EnvironmentProfile {
    pub fn new(workflow_id: String, name: String, variables: std::collections::HashMap<String, String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            workflow_id,
            name,
            variables: serde_json::to_string(&variables).unwrap_or_else(|_| "{}".to_string()),
            created_at: Utc::now().to_rfc3339(),
        }
    }
}
