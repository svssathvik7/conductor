use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StartupVariable {
    pub name: String,
    pub default_value: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Workflow {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: String,
    pub startup_variables: String, // JSON string of Vec<StartupVariable>
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkflow {
    pub name: String,
    pub description: Option<String>,
    pub startup_variables: Option<Vec<StartupVariable>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkflow {
    pub name: Option<String>,
    pub description: Option<String>,
    pub startup_variables: Option<Vec<StartupVariable>>,
}

impl Workflow {
    pub fn new(
        project_id: String,
        name: String,
        description: String,
        startup_variables: Vec<StartupVariable>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            project_id,
            name,
            description,
            startup_variables: serde_json::to_string(&startup_variables)
                .unwrap_or_else(|_| "[]".to_string()),
            created_at: Utc::now().to_rfc3339(),
        }
    }
}
