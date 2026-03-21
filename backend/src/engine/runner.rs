use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tokio::sync::mpsc;
use crate::engine::{interpolator::interpolate, evaluator::evaluate};
use crate::models::condition::Condition;
use crate::models::step::{ResponseSchemaField, Step};

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RunEvent {
    StepStart {
        step_id: String,
        step_name: String,
    },
    StepComplete {
        step_id: String,
        status: String,
        extracted: HashMap<String, String>,
    },
    StepFailed {
        step_id: String,
        error: String,
        response: String,
    },
    ConditionFail {
        condition_id: String,
        expression: String,
    },
    RunComplete {
        status: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StepResult {
    pub step_id: String,
    pub status: String,
    pub response_body: String,
    pub extracted_vars: HashMap<String, String>,
    pub error: Option<String>,
}

fn resolve_json_path(value: &serde_json::Value, path: &str) -> String {
    let mut current = value;
    for key in path.split('.') {
        match current.get(key) {
            Some(v) => current = v,
            None => return String::new(),
        }
    }
    match current {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Null => String::new(),
        other => other.to_string(),
    }
}

/// Returns (step_results, final_status) where final_status is "passed" or "failed"
pub async fn run_workflow(
    pool: &SqlitePool,
    workflow_id: &str,
    startup_vars: HashMap<String, String>,
    tx: mpsc::Sender<RunEvent>,
) -> (Vec<StepResult>, String) {
    let steps: Vec<Step> = sqlx::query_as::<_, Step>(
        "SELECT * FROM steps WHERE workflow_id = ? ORDER BY order_index ASC",
    )
    .bind(workflow_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let conditions: Vec<Condition> = sqlx::query_as::<_, Condition>(
        "SELECT * FROM conditions WHERE workflow_id = ?",
    )
    .bind(workflow_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut ctx: HashMap<String, String> = startup_vars;
    let mut results: Vec<StepResult> = Vec::new();
    let client = reqwest::Client::new();

    for step in &steps {
        // Notify start
        let _ = tx
            .send(RunEvent::StepStart {
                step_id: step.id.clone(),
                step_name: step.name.clone(),
            })
            .await;

        // Interpolate URL, headers, body
        let url = interpolate(&step.url, &ctx);
        let body = interpolate(&step.body, &ctx);

        let headers: Vec<crate::models::step::Header> =
            serde_json::from_str(&step.headers).unwrap_or_default();

        // Build request
        let method: reqwest::Method = step.method.parse().unwrap_or(reqwest::Method::GET);
        let mut req = client.request(method, &url);

        for h in &headers {
            let key = interpolate(&h.key, &ctx);
            let val = interpolate(&h.value, &ctx);
            req = req.header(key, val);
        }

        if !body.is_empty() {
            req = req
                .header("content-type", "application/json")
                .body(body);
        }

        // Execute request
        match req.send().await {
            Ok(resp) => {
                let http_status = resp.status();
                let body_text = resp.text().await.unwrap_or_default();
                let body_json: serde_json::Value =
                    serde_json::from_str(&body_text).unwrap_or(serde_json::Value::Null);

                // Extract variables from response schema
                let schema: Vec<ResponseSchemaField> =
                    serde_json::from_str(&step.response_schema).unwrap_or_default();
                let mut extracted: HashMap<String, String> = HashMap::new();

                for field in &schema {
                    let val = resolve_json_path(&body_json, &field.path);
                    let key = format!("step{}.{}", step.order_index + 1, field.alias);
                    ctx.insert(key, val.clone());
                    extracted.insert(field.alias.clone(), val);
                }

                if http_status.is_success() {
                    let _ = tx
                        .send(RunEvent::StepComplete {
                            step_id: step.id.clone(),
                            status: "passed".to_string(),
                            extracted: extracted.clone(),
                        })
                        .await;
                    results.push(StepResult {
                        step_id: step.id.clone(),
                        status: "passed".to_string(),
                        response_body: body_text,
                        extracted_vars: extracted,
                        error: None,
                    });
                } else if step.on_failure == "CONTINUE" {
                    // Non-2xx but step says continue
                    let _ = tx
                        .send(RunEvent::StepComplete {
                            step_id: step.id.clone(),
                            status: "passed".to_string(),
                            extracted: extracted.clone(),
                        })
                        .await;
                    results.push(StepResult {
                        step_id: step.id.clone(),
                        status: "passed".to_string(),
                        response_body: body_text,
                        extracted_vars: extracted,
                        error: None,
                    });
                } else {
                    let error_msg = format!("HTTP {}", http_status);
                    let _ = tx
                        .send(RunEvent::StepFailed {
                            step_id: step.id.clone(),
                            error: error_msg.clone(),
                            response: body_text.clone(),
                        })
                        .await;
                    results.push(StepResult {
                        step_id: step.id.clone(),
                        status: "failed".to_string(),
                        response_body: body_text,
                        extracted_vars: extracted,
                        error: Some(error_msg),
                    });
                    let _ = tx
                        .send(RunEvent::RunComplete {
                            status: "failed".to_string(),
                        })
                        .await;
                    return (results, "failed".to_string());
                }
            }
            Err(e) => {
                let error_msg = e.to_string();
                let _ = tx
                    .send(RunEvent::StepFailed {
                        step_id: step.id.clone(),
                        error: error_msg.clone(),
                        response: String::new(),
                    })
                    .await;
                results.push(StepResult {
                    step_id: step.id.clone(),
                    status: "failed".to_string(),
                    response_body: String::new(),
                    extracted_vars: HashMap::new(),
                    error: Some(error_msg),
                });
                let _ = tx
                    .send(RunEvent::RunComplete {
                        status: "failed".to_string(),
                    })
                    .await;
                return (results, "failed".to_string());
            }
        }

        // Evaluate condition gate after this step
        // Logic: IF expression is TRUE → trigger the action (FAIL/STOP)
        if let Some(cond) = conditions.iter().find(|c| c.after_step_id == step.id) {
            match evaluate(&cond.expression, &ctx) {
                Ok(false) => {
                    // Condition not met — continue to next step
                }
                Ok(true) => {
                    let _ = tx
                        .send(RunEvent::ConditionFail {
                            condition_id: cond.id.clone(),
                            expression: cond.expression.clone(),
                        })
                        .await;
                    let _ = tx
                        .send(RunEvent::RunComplete {
                            status: "failed".to_string(),
                        })
                        .await;
                    return (results, "failed".to_string());
                }
                Err(_) => {
                    // Evaluation error — skip the condition and continue
                }
            }
        }

        // Check on_success flag
        if step.on_success == "STOP" {
            break;
        }
    }

    let _ = tx
        .send(RunEvent::RunComplete {
            status: "passed".to_string(),
        })
        .await;
    (results, "passed".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_ctx(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn test_resolve_json_path_simple() {
        let v: serde_json::Value = serde_json::json!({"result": {"amount": "500"}});
        assert_eq!(resolve_json_path(&v, "result.amount"), "500");
    }

    #[test]
    fn test_resolve_json_path_missing() {
        let v: serde_json::Value = serde_json::json!({"a": "b"});
        assert_eq!(resolve_json_path(&v, "x.y"), "");
    }

    #[test]
    fn test_resolve_json_path_number() {
        let v: serde_json::Value = serde_json::json!({"count": 42});
        assert_eq!(resolve_json_path(&v, "count"), "42");
    }
}
