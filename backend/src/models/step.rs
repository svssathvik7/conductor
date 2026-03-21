use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Header {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResponseSchemaField {
    pub path: String,
    pub alias: String,
    pub field_type: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Step {
    pub id: String,
    pub workflow_id: String,
    pub order_index: i64,
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: String,
    pub body: String,
    pub response_schema: String,
    pub on_success: String,
    pub on_failure: String,
    pub loop_type: String,
    pub loop_config: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateStep {
    pub name: String,
    pub method: Option<String>,
    pub url: Option<String>,
    pub headers: Option<Vec<Header>>,
    pub body: Option<String>,
    pub response_schema: Option<Vec<ResponseSchemaField>>,
    pub on_success: Option<String>,
    pub on_failure: Option<String>,
    pub loop_type: Option<String>,
    pub loop_config: Option<String>,
}

impl Step {
    pub fn new(workflow_id: String, order_index: i64, payload: CreateStep) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            workflow_id,
            order_index,
            name: payload.name,
            method: payload.method.unwrap_or_else(|| "GET".to_string()),
            url: payload.url.unwrap_or_default(),
            headers: serde_json::to_string(&payload.headers.unwrap_or_default())
                .unwrap_or_else(|_| "[]".to_string()),
            body: payload.body.unwrap_or_default(),
            response_schema: serde_json::to_string(&payload.response_schema.unwrap_or_default())
                .unwrap_or_else(|_| "[]".to_string()),
            on_success: payload.on_success.unwrap_or_else(|| "CONTINUE".to_string()),
            on_failure: payload.on_failure.unwrap_or_else(|| "STOP".to_string()),
            loop_type: payload.loop_type.unwrap_or_else(|| "none".to_string()),
            loop_config: payload.loop_config.unwrap_or_else(|| "{}".to_string()),
        }
    }
}
