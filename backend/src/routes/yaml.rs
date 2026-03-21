use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::models::condition::Condition;
use crate::models::profile::EnvironmentProfile;
use crate::models::step::{CreateStep, Header, ResponseSchemaField, Step};
use crate::models::workflow::{StartupVariable, Workflow};

// ── YAML serialization structs ──────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct WorkflowYaml {
    pub name: String,
    pub description: String,
    pub startup_variables: Vec<StartupVariableYaml>,
    #[serde(default)]
    pub profiles: Vec<ProfileYaml>,
    pub steps: Vec<StepYaml>,
    #[serde(default)]
    pub conditions: Vec<ConditionYaml>,
}

#[derive(Serialize, Deserialize)]
pub struct StartupVariableYaml {
    pub name: String,
    pub default_value: String,
    pub description: String,
}

#[derive(Serialize, Deserialize)]
pub struct ProfileYaml {
    pub name: String,
    pub variables: HashMap<String, String>,
}

#[derive(Serialize, Deserialize)]
pub struct StepYaml {
    pub name: String,
    pub order_index: i64,
    pub method: String,
    pub url: String,
    pub headers: Vec<HeaderYaml>,
    pub body: String,
    pub response_schema: Vec<ResponseSchemaFieldYaml>,
    pub on_success: String,
    pub on_failure: String,
    #[serde(default = "default_loop_type")]
    pub loop_type: String,
    #[serde(default = "default_loop_config")]
    pub loop_config: String,
}

fn default_loop_type() -> String {
    "none".to_string()
}

fn default_loop_config() -> String {
    "{}".to_string()
}

#[derive(Serialize, Deserialize)]
pub struct HeaderYaml {
    pub key: String,
    pub value: String,
}

#[derive(Serialize, Deserialize)]
pub struct ResponseSchemaFieldYaml {
    pub path: String,
    pub alias: String,
    pub field_type: String,
}

#[derive(Serialize, Deserialize)]
pub struct ConditionYaml {
    pub after_step_index: i64,
    pub expression: String,
    pub action: String,
}

// ── Router ──────────────────────────────────────────────────────────────────

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route("/workflows/:id/export", get(export_workflow))
        .route("/projects/:project_id/import", post(import_workflow))
}

// ── Export ───────────────────────────────────────────────────────────────────

async fn export_workflow(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Response, StatusCode> {
    // Fetch workflow
    let workflow = sqlx::query_as::<_, Workflow>("SELECT * FROM workflows WHERE id = ?")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .unwrap()
        .ok_or(StatusCode::NOT_FOUND)?;

    // Fetch steps ordered by order_index
    let steps = sqlx::query_as::<_, Step>(
        "SELECT * FROM steps WHERE workflow_id = ? ORDER BY order_index ASC",
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    // Fetch conditions
    let conditions = sqlx::query_as::<_, Condition>(
        "SELECT * FROM conditions WHERE workflow_id = ?",
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    // Fetch profiles
    let profiles = sqlx::query_as::<_, EnvironmentProfile>(
        "SELECT * FROM environment_profiles WHERE workflow_id = ? ORDER BY created_at ASC",
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    // Build a map from step id -> order_index for condition references
    let step_id_to_index: HashMap<String, i64> = steps
        .iter()
        .map(|s| (s.id.clone(), s.order_index))
        .collect();

    // Build WorkflowYaml
    let startup_vars: Vec<StartupVariable> =
        serde_json::from_str(&workflow.startup_variables).unwrap_or_default();

    let yaml_struct = WorkflowYaml {
        name: workflow.name.clone(),
        description: workflow.description.clone(),
        startup_variables: startup_vars
            .into_iter()
            .map(|v| StartupVariableYaml {
                name: v.name,
                default_value: v.default_value,
                description: v.description,
            })
            .collect(),
        profiles: profiles
            .into_iter()
            .map(|p| {
                let vars: HashMap<String, String> =
                    serde_json::from_str(&p.variables).unwrap_or_default();
                ProfileYaml {
                    name: p.name,
                    variables: vars,
                }
            })
            .collect(),
        steps: steps
            .iter()
            .map(|s| {
                let headers: Vec<Header> =
                    serde_json::from_str(&s.headers).unwrap_or_default();
                let schema: Vec<ResponseSchemaField> =
                    serde_json::from_str(&s.response_schema).unwrap_or_default();
                StepYaml {
                    name: s.name.clone(),
                    order_index: s.order_index,
                    method: s.method.clone(),
                    url: s.url.clone(),
                    headers: headers
                        .into_iter()
                        .map(|h| HeaderYaml {
                            key: h.key,
                            value: h.value,
                        })
                        .collect(),
                    body: s.body.clone(),
                    response_schema: schema
                        .into_iter()
                        .map(|f| ResponseSchemaFieldYaml {
                            path: f.path,
                            alias: f.alias,
                            field_type: f.field_type,
                        })
                        .collect(),
                    on_success: s.on_success.clone(),
                    on_failure: s.on_failure.clone(),
                    loop_type: s.loop_type.clone(),
                    loop_config: s.loop_config.clone(),
                }
            })
            .collect(),
        conditions: conditions
            .into_iter()
            .filter_map(|c| {
                let idx = step_id_to_index.get(&c.after_step_id)?;
                Some(ConditionYaml {
                    after_step_index: *idx,
                    expression: c.expression,
                    action: c.action,
                })
            })
            .collect(),
    };

    let yaml_string = serde_yaml::to_string(&yaml_struct).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Sanitize filename
    let safe_name: String = workflow
        .name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/x-yaml")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}.yaml\"", safe_name),
        )
        .body(Body::from(yaml_string))
        .unwrap())
}

// ── Import ──────────────────────────────────────────────────────────────────

async fn import_workflow(
    State(pool): State<SqlitePool>,
    Path(project_id): Path<String>,
    body: String,
) -> Result<(StatusCode, Json<Workflow>), StatusCode> {
    let yaml: WorkflowYaml =
        serde_yaml::from_str(&body).map_err(|_| StatusCode::BAD_REQUEST)?;

    // Convert startup variables
    let startup_vars: Vec<StartupVariable> = yaml
        .startup_variables
        .into_iter()
        .map(|v| StartupVariable {
            name: v.name,
            default_value: v.default_value,
            description: v.description,
        })
        .collect();

    // Create workflow
    let workflow = Workflow::new(project_id, yaml.name, yaml.description, startup_vars);
    sqlx::query(
        "INSERT INTO workflows (id, project_id, name, description, startup_variables, created_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&workflow.id)
    .bind(&workflow.project_id)
    .bind(&workflow.name)
    .bind(&workflow.description)
    .bind(&workflow.startup_variables)
    .bind(&workflow.created_at)
    .execute(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Create steps and build order_index -> new step id map
    let mut index_to_step_id: HashMap<i64, String> = HashMap::new();
    for step_yaml in &yaml.steps {
        let headers: Vec<Header> = step_yaml
            .headers
            .iter()
            .map(|h| Header {
                key: h.key.clone(),
                value: h.value.clone(),
            })
            .collect();
        let schema: Vec<ResponseSchemaField> = step_yaml
            .response_schema
            .iter()
            .map(|f| ResponseSchemaField {
                path: f.path.clone(),
                alias: f.alias.clone(),
                field_type: f.field_type.clone(),
            })
            .collect();

        let step = Step::new(
            workflow.id.clone(),
            step_yaml.order_index,
            CreateStep {
                name: step_yaml.name.clone(),
                method: Some(step_yaml.method.clone()),
                url: Some(step_yaml.url.clone()),
                headers: Some(headers),
                body: Some(step_yaml.body.clone()),
                response_schema: Some(schema),
                on_success: Some(step_yaml.on_success.clone()),
                on_failure: Some(step_yaml.on_failure.clone()),
                loop_type: Some(step_yaml.loop_type.clone()),
                loop_config: Some(step_yaml.loop_config.clone()),
            },
        );

        index_to_step_id.insert(step_yaml.order_index, step.id.clone());

        sqlx::query(
            "INSERT INTO steps \
             (id, workflow_id, order_index, name, method, url, headers, body, response_schema, on_success, on_failure, loop_type, loop_config) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&step.id)
        .bind(&step.workflow_id)
        .bind(step.order_index)
        .bind(&step.name)
        .bind(&step.method)
        .bind(&step.url)
        .bind(&step.headers)
        .bind(&step.body)
        .bind(&step.response_schema)
        .bind(&step.on_success)
        .bind(&step.on_failure)
        .bind(&step.loop_type)
        .bind(&step.loop_config)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    // Create conditions
    for cond_yaml in &yaml.conditions {
        let after_step_id = index_to_step_id
            .get(&cond_yaml.after_step_index)
            .ok_or(StatusCode::BAD_REQUEST)?;

        let condition = Condition::new(
            after_step_id.clone(),
            workflow.id.clone(),
            cond_yaml.expression.clone(),
            cond_yaml.action.clone(),
        );

        sqlx::query(
            "INSERT INTO conditions (id, workflow_id, after_step_id, expression, action) \
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&condition.id)
        .bind(&condition.workflow_id)
        .bind(&condition.after_step_id)
        .bind(&condition.expression)
        .bind(&condition.action)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    // Create profiles
    for profile_yaml in &yaml.profiles {
        let profile = EnvironmentProfile::new(
            workflow.id.clone(),
            profile_yaml.name.clone(),
            profile_yaml.variables.clone(),
        );

        sqlx::query(
            "INSERT INTO environment_profiles (id, workflow_id, name, variables, created_at) \
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&profile.id)
        .bind(&profile.workflow_id)
        .bind(&profile.name)
        .bind(&profile.variables)
        .bind(&profile.created_at)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    Ok((StatusCode::CREATED, Json(workflow)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::routes;
    use axum::Router;
    use axum_test::TestServer;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO projects (id, name, description, created_at) \
             VALUES ('p1', 'Test Project', '', '2024-01-01T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn test_export_import_round_trip() {
        let pool = test_pool().await;
        let app = Router::new()
            .nest("/api", routes::router())
            .with_state(pool);
        let server = TestServer::new(app).unwrap();

        // 1. Create a workflow with startup variables
        let res = server
            .post("/api/projects/p1/workflows")
            .json(&serde_json::json!({
                "name": "Round Trip Test",
                "description": "A test workflow",
                "startup_variables": [
                    {"name": "base_url", "default_value": "https://api.example.com", "description": "Base URL"}
                ]
            }))
            .await;
        res.assert_status(StatusCode::CREATED);
        let wf: Workflow = res.json();

        // 2. Create two steps
        let res = server
            .post(&format!("/api/workflows/{}/steps", wf.id))
            .json(&serde_json::json!({
                "name": "Auth Step",
                "method": "POST",
                "url": "{{base_url}}/auth",
                "headers": [{"key": "Content-Type", "value": "application/json"}],
                "body": "{\"user\": \"test\"}",
                "response_schema": [{"path": "$.token", "alias": "auth_token", "field_type": "string"}],
                "on_success": "CONTINUE",
                "on_failure": "STOP"
            }))
            .await;
        res.assert_status(StatusCode::CREATED);
        let step1: Step = res.json();

        let res = server
            .post(&format!("/api/workflows/{}/steps", wf.id))
            .json(&serde_json::json!({
                "name": "Data Step",
                "method": "GET",
                "url": "{{base_url}}/data"
            }))
            .await;
        res.assert_status(StatusCode::CREATED);

        // 3. Create a condition after step 1
        let res = server
            .post(&format!("/api/steps/{}/condition", step1.id))
            .json(&serde_json::json!({
                "workflow_id": wf.id,
                "expression": "step1.auth_token != \"\"",
                "action": "FAIL"
            }))
            .await;
        res.assert_status(StatusCode::CREATED);

        // 4. Create a profile
        let res = server
            .post(&format!("/api/workflows/{}/profiles", wf.id))
            .json(&serde_json::json!({
                "name": "dev",
                "variables": {"base_url": "https://dev.api.com", "token": "dev-123"}
            }))
            .await;
        res.assert_status(StatusCode::CREATED);

        // 5. Export
        let res = server
            .get(&format!("/api/workflows/{}/export", wf.id))
            .await;
        res.assert_status_ok();
        let yaml_bytes = res.into_bytes();
        let yaml_string = String::from_utf8(yaml_bytes.to_vec()).unwrap();

        // Verify it's valid YAML
        let parsed: WorkflowYaml = serde_yaml::from_str(&yaml_string).unwrap();
        assert_eq!(parsed.name, "Round Trip Test");
        assert_eq!(parsed.steps.len(), 2);
        assert_eq!(parsed.conditions.len(), 1);
        assert_eq!(parsed.profiles.len(), 1);
        assert_eq!(parsed.startup_variables.len(), 1);

        // 6. Import into the same project
        let res = server
            .post("/api/projects/p1/import")
            .content_type("application/x-yaml")
            .bytes(yaml_string.into_bytes().into())
            .await;
        res.assert_status(StatusCode::CREATED);
        let imported: Workflow = res.json();
        assert_eq!(imported.name, "Round Trip Test");
        assert_ne!(imported.id, wf.id); // new UUID

        // 7. Verify imported steps
        let res = server
            .get(&format!("/api/workflows/{}/steps", imported.id))
            .await;
        let imported_steps: Vec<Step> = res.json();
        assert_eq!(imported_steps.len(), 2);
        assert_eq!(imported_steps[0].name, "Auth Step");
        assert_eq!(imported_steps[1].name, "Data Step");

        // Verify headers survived round-trip
        let headers: Vec<Header> =
            serde_json::from_str(&imported_steps[0].headers).unwrap();
        assert_eq!(headers.len(), 1);
        assert_eq!(headers[0].key, "Content-Type");

        // 8. Verify imported conditions
        let res = server
            .get(&format!("/api/workflows/{}/conditions", imported.id))
            .await;
        let imported_conditions: Vec<Condition> = res.json();
        assert_eq!(imported_conditions.len(), 1);
        assert_eq!(imported_conditions[0].expression, "step1.auth_token != \"\"");

        // 9. Verify imported profiles
        let res = server
            .get(&format!("/api/workflows/{}/profiles", imported.id))
            .await;
        let imported_profiles: Vec<EnvironmentProfile> = res.json();
        assert_eq!(imported_profiles.len(), 1);
        assert_eq!(imported_profiles[0].name, "dev");
    }
}
