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
    ParallelGroupStart {
        step_ids: Vec<String>,
    },
    ParallelGroupComplete {
        step_ids: Vec<String>,
        status: String,
    },
    LoopStart {
        step_id: String,
        total_iterations: usize,
    },
    IterationStart {
        step_id: String,
        iteration: usize,
    },
    IterationComplete {
        step_id: String,
        iteration: usize,
        status: String,
        extracted: HashMap<String, String>,
    },
    IterationFailed {
        step_id: String,
        iteration: usize,
        error: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IterationResult {
    pub index: usize,
    pub status: String,
    pub response_body: String,
    pub extracted_vars: HashMap<String, String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StepResult {
    pub step_id: String,
    pub status: String,
    pub response_body: String,
    pub extracted_vars: HashMap<String, String>,
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iterations: Option<Vec<IterationResult>>,
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

enum ExecutionUnit<'a> {
    Single(&'a Step),
    Parallel(Vec<&'a Step>),
}

fn group_steps(steps: &[Step]) -> Vec<ExecutionUnit<'_>> {
    let mut units: Vec<ExecutionUnit> = Vec::new();
    let mut i = 0;
    while i < steps.len() {
        if let Some(ref group) = steps[i].parallel_group {
            let mut group_steps = vec![&steps[i]];
            let mut j = i + 1;
            while j < steps.len() {
                if steps[j].parallel_group.as_deref() == Some(group.as_str()) {
                    group_steps.push(&steps[j]);
                    j += 1;
                } else {
                    break;
                }
            }
            if group_steps.len() > 1 {
                units.push(ExecutionUnit::Parallel(group_steps));
            } else {
                units.push(ExecutionUnit::Single(&steps[i]));
            }
            i = j;
        } else {
            units.push(ExecutionUnit::Single(&steps[i]));
            i += 1;
        }
    }
    units
}

/// Determine how many iterations a step should run and what values to inject.
/// Returns a vec of optional string values — one per iteration.
/// For "none" loop type, returns a single None (run once, no special iteration context).
fn resolve_iterations(step: &Step, ctx: &HashMap<String, String>) -> Vec<Option<String>> {
    if step.loop_type == "none" {
        return vec![None]; // single execution
    }
    let config: serde_json::Value =
        serde_json::from_str(&step.loop_config).unwrap_or_default();
    match step.loop_type.as_str() {
        "count" => {
            let count = config
                .get("count")
                .and_then(|v| v.as_u64())
                .unwrap_or(1) as usize;
            vec![None; count]
        }
        "for_each" => {
            let source_var = config
                .get("source_var")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let raw = ctx.get(source_var).cloned().unwrap_or_default();
            let arr: Vec<serde_json::Value> =
                serde_json::from_str(&raw).unwrap_or_default();
            if arr.is_empty() {
                return vec![None]; // fallback: run once if array is empty
            }
            arr.into_iter()
                .map(|v| match v {
                    serde_json::Value::String(s) => Some(s),
                    other => Some(other.to_string()),
                })
                .collect()
        }
        _ => vec![None],
    }
}

/// Execute a single HTTP request for a step, extract variables, and return the result.
/// `var_prefix` determines how extracted variables are named in the context
/// (e.g. "step1" for non-loop, "step1.iteration[0]" for loop iterations).
async fn execute_step(
    step: &Step,
    ctx: &mut HashMap<String, String>,
    client: &reqwest::Client,
    var_prefix: &str,
) -> StepResult {
    // Interpolate URL, headers, body
    let url = interpolate(&step.url, ctx);
    let body = interpolate(&step.body, ctx);

    let headers: Vec<crate::models::step::Header> =
        serde_json::from_str(&step.headers).unwrap_or_default();

    // Build request
    let method: reqwest::Method = step.method.parse().unwrap_or(reqwest::Method::GET);
    let mut req = client.request(method, &url);

    for h in &headers {
        let key = interpolate(&h.key, ctx);
        let val = interpolate(&h.value, ctx);
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
                let key = format!("{}.{}", var_prefix, field.alias);
                ctx.insert(key, val.clone());
                extracted.insert(field.alias.clone(), val);
            }

            if http_status.is_success() || step.on_failure == "CONTINUE" {
                StepResult {
                    step_id: step.id.clone(),
                    status: "passed".to_string(),
                    response_body: body_text,
                    extracted_vars: extracted,
                    error: None,
                    iterations: None,
                }
            } else {
                let error_msg = format!("HTTP {}", http_status);
                StepResult {
                    step_id: step.id.clone(),
                    status: "failed".to_string(),
                    response_body: body_text,
                    extracted_vars: extracted,
                    error: Some(error_msg),
                    iterations: None,
                }
            }
        }
        Err(e) => {
            StepResult {
                step_id: step.id.clone(),
                status: "failed".to_string(),
                response_body: String::new(),
                extracted_vars: HashMap::new(),
                error: Some(e.to_string()),
                iterations: None,
            }
        }
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

    let execution_units = group_steps(&steps);

    for unit in &execution_units {
        match unit {
            ExecutionUnit::Single(step) => {
                let step_num = step.order_index + 1;
                let iterations = resolve_iterations(step, &ctx);
                let is_loop = step.loop_type != "none";

                if is_loop {
                    let _ = tx
                        .send(RunEvent::LoopStart {
                            step_id: step.id.clone(),
                            total_iterations: iterations.len(),
                        })
                        .await;
                }

                // Notify start
                let _ = tx
                    .send(RunEvent::StepStart {
                        step_id: step.id.clone(),
                        step_name: step.name.clone(),
                    })
                    .await;

                let mut all_iteration_results: Vec<IterationResult> = Vec::new();
                let mut step_failed = false;
                let mut last_response_body = String::new();
                let mut last_extracted = HashMap::new();
                let mut last_error: Option<String> = None;

                for (iter_idx, iter_value) in iterations.iter().enumerate() {
                    if is_loop {
                        let _ = tx
                            .send(RunEvent::IterationStart {
                                step_id: step.id.clone(),
                                iteration: iter_idx,
                            })
                            .await;

                        // Set iteration context variables
                        if let Some(val) = iter_value {
                            ctx.insert(format!("step{}.current.item", step_num), val.clone());
                        }
                        ctx.insert(
                            format!("step{}.current.index", step_num),
                            iter_idx.to_string(),
                        );
                    }

                    // Determine variable prefix for this execution
                    let var_prefix = if is_loop {
                        format!("step{}.iteration[{}]", step_num, iter_idx)
                    } else {
                        format!("step{}", step_num)
                    };

                    let result = execute_step(step, &mut ctx, &client, &var_prefix).await;

                    last_response_body = result.response_body.clone();
                    last_extracted = result.extracted_vars.clone();
                    last_error = result.error.clone();

                    if is_loop {
                        if result.status == "failed" {
                            let _ = tx
                                .send(RunEvent::IterationFailed {
                                    step_id: step.id.clone(),
                                    iteration: iter_idx,
                                    error: result.error.clone().unwrap_or_default(),
                                })
                                .await;
                            if step.on_failure != "CONTINUE" {
                                step_failed = true;
                                all_iteration_results.push(IterationResult {
                                    index: iter_idx,
                                    status: result.status.clone(),
                                    response_body: result.response_body.clone(),
                                    extracted_vars: result.extracted_vars.clone(),
                                    error: result.error.clone(),
                                });
                                break;
                            }
                        } else {
                            let _ = tx
                                .send(RunEvent::IterationComplete {
                                    step_id: step.id.clone(),
                                    iteration: iter_idx,
                                    status: "passed".to_string(),
                                    extracted: result.extracted_vars.clone(),
                                })
                                .await;
                        }
                        all_iteration_results.push(IterationResult {
                            index: iter_idx,
                            status: result.status.clone(),
                            response_body: result.response_body.clone(),
                            extracted_vars: result.extracted_vars.clone(),
                            error: result.error.clone(),
                        });
                    } else {
                        // Non-loop step: check for failure
                        if result.status == "failed" {
                            let _ = tx
                                .send(RunEvent::StepFailed {
                                    step_id: step.id.clone(),
                                    error: result.error.clone().unwrap_or_default(),
                                    response: result.response_body.clone(),
                                })
                                .await;
                            results.push(result);
                            let _ = tx
                                .send(RunEvent::RunComplete {
                                    status: "failed".to_string(),
                                })
                                .await;
                            return (results, "failed".to_string());
                        }
                    }
                }

                // Build the final StepResult for this step
                if is_loop {
                    let final_status = if step_failed { "failed" } else { "passed" };

                    let step_result = StepResult {
                        step_id: step.id.clone(),
                        status: final_status.to_string(),
                        response_body: last_response_body,
                        extracted_vars: last_extracted.clone(),
                        error: if step_failed { last_error } else { None },
                        iterations: Some(all_iteration_results),
                    };

                    if step_failed {
                        let _ = tx
                            .send(RunEvent::StepFailed {
                                step_id: step.id.clone(),
                                error: step_result.error.clone().unwrap_or_default(),
                                response: step_result.response_body.clone(),
                            })
                            .await;
                        let _ = tx
                            .send(RunEvent::RunComplete {
                                status: "failed".to_string(),
                            })
                            .await;
                        results.push(step_result);
                        return (results, "failed".to_string());
                    }

                    let _ = tx
                        .send(RunEvent::StepComplete {
                            step_id: step.id.clone(),
                            status: "passed".to_string(),
                            extracted: last_extracted,
                        })
                        .await;
                    results.push(step_result);
                } else {
                    // Non-loop: the step already succeeded (failure returned early above)
                    let _ = tx
                        .send(RunEvent::StepComplete {
                            step_id: step.id.clone(),
                            status: "passed".to_string(),
                            extracted: last_extracted.clone(),
                        })
                        .await;
                    results.push(StepResult {
                        step_id: step.id.clone(),
                        status: "passed".to_string(),
                        response_body: last_response_body,
                        extracted_vars: last_extracted,
                        error: None,
                        iterations: None,
                    });
                }

                // Evaluate condition gate after this step
                if let Some(cond) = conditions.iter().find(|c| c.after_step_id == step.id) {
                    match evaluate(&cond.expression, &ctx) {
                        Ok(false) => {}
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
                        Err(_) => {}
                    }
                }

                // Check on_success flag
                if step.on_success == "STOP" {
                    break;
                }
            }
            ExecutionUnit::Parallel(parallel_steps) => {
                let step_ids: Vec<String> =
                    parallel_steps.iter().map(|s| s.id.clone()).collect();

                let _ = tx
                    .send(RunEvent::ParallelGroupStart {
                        step_ids: step_ids.clone(),
                    })
                    .await;

                // Snapshot the current ctx for all parallel steps
                let ctx_snapshot = ctx.clone();

                // Spawn all steps concurrently
                let mut handles = Vec::new();
                for step in parallel_steps {
                    let step_clone = (*step).clone();
                    let mut step_ctx = ctx_snapshot.clone();
                    let client_clone = client.clone();
                    let tx_clone = tx.clone();

                    let handle = tokio::spawn(async move {
                        let step_num = step_clone.order_index + 1;

                        let _ = tx_clone
                            .send(RunEvent::StepStart {
                                step_id: step_clone.id.clone(),
                                step_name: step_clone.name.clone(),
                            })
                            .await;

                        let iterations = resolve_iterations(&step_clone, &step_ctx);
                        let is_loop = step_clone.loop_type != "none";

                        if is_loop {
                            let _ = tx_clone
                                .send(RunEvent::LoopStart {
                                    step_id: step_clone.id.clone(),
                                    total_iterations: iterations.len(),
                                })
                                .await;

                            let mut all_iteration_results: Vec<IterationResult> = Vec::new();
                            let mut step_failed = false;
                            let mut last_response_body = String::new();
                            let mut last_extracted = HashMap::new();
                            let mut last_error: Option<String> = None;

                            for (iter_idx, iter_value) in iterations.iter().enumerate() {
                                let _ = tx_clone
                                    .send(RunEvent::IterationStart {
                                        step_id: step_clone.id.clone(),
                                        iteration: iter_idx,
                                    })
                                    .await;

                                if let Some(val) = iter_value {
                                    step_ctx.insert(
                                        format!("step{}.current.item", step_num),
                                        val.clone(),
                                    );
                                }
                                step_ctx.insert(
                                    format!("step{}.current.index", step_num),
                                    iter_idx.to_string(),
                                );

                                let var_prefix =
                                    format!("step{}.iteration[{}]", step_num, iter_idx);
                                let result = execute_step(
                                    &step_clone,
                                    &mut step_ctx,
                                    &client_clone,
                                    &var_prefix,
                                )
                                .await;

                                last_response_body = result.response_body.clone();
                                last_extracted = result.extracted_vars.clone();
                                last_error = result.error.clone();

                                if result.status == "failed" {
                                    let _ = tx_clone
                                        .send(RunEvent::IterationFailed {
                                            step_id: step_clone.id.clone(),
                                            iteration: iter_idx,
                                            error: result.error.clone().unwrap_or_default(),
                                        })
                                        .await;
                                    if step_clone.on_failure != "CONTINUE" {
                                        step_failed = true;
                                        all_iteration_results.push(IterationResult {
                                            index: iter_idx,
                                            status: result.status.clone(),
                                            response_body: result.response_body.clone(),
                                            extracted_vars: result.extracted_vars.clone(),
                                            error: result.error.clone(),
                                        });
                                        break;
                                    }
                                } else {
                                    let _ = tx_clone
                                        .send(RunEvent::IterationComplete {
                                            step_id: step_clone.id.clone(),
                                            iteration: iter_idx,
                                            status: "passed".to_string(),
                                            extracted: result.extracted_vars.clone(),
                                        })
                                        .await;
                                }
                                all_iteration_results.push(IterationResult {
                                    index: iter_idx,
                                    status: result.status.clone(),
                                    response_body: result.response_body.clone(),
                                    extracted_vars: result.extracted_vars.clone(),
                                    error: result.error.clone(),
                                });
                            }

                            let final_status =
                                if step_failed { "failed" } else { "passed" };

                            let step_result = StepResult {
                                step_id: step_clone.id.clone(),
                                status: final_status.to_string(),
                                response_body: last_response_body,
                                extracted_vars: last_extracted,
                                error: if step_failed { last_error } else { None },
                                iterations: Some(all_iteration_results),
                            };

                            if step_failed {
                                let _ = tx_clone
                                    .send(RunEvent::StepFailed {
                                        step_id: step_clone.id.clone(),
                                        error: step_result.error.clone().unwrap_or_default(),
                                        response: step_result.response_body.clone(),
                                    })
                                    .await;
                            } else {
                                let _ = tx_clone
                                    .send(RunEvent::StepComplete {
                                        step_id: step_clone.id.clone(),
                                        status: "passed".to_string(),
                                        extracted: step_result.extracted_vars.clone(),
                                    })
                                    .await;
                            }

                            (step_clone.order_index, step_result, step_ctx)
                        } else {
                            // Non-loop parallel step
                            let var_prefix = format!("step{}", step_num);
                            let result = execute_step(
                                &step_clone,
                                &mut step_ctx,
                                &client_clone,
                                &var_prefix,
                            )
                            .await;

                            if result.status == "passed" {
                                let _ = tx_clone
                                    .send(RunEvent::StepComplete {
                                        step_id: step_clone.id.clone(),
                                        status: "passed".to_string(),
                                        extracted: result.extracted_vars.clone(),
                                    })
                                    .await;
                            } else {
                                let _ = tx_clone
                                    .send(RunEvent::StepFailed {
                                        step_id: step_clone.id.clone(),
                                        error: result.error.clone().unwrap_or_default(),
                                        response: result.response_body.clone(),
                                    })
                                    .await;
                            }

                            (step_clone.order_index, result, step_ctx)
                        }
                    });
                    handles.push(handle);
                }

                // Wait for all
                let mut parallel_results: Vec<(i64, StepResult, HashMap<String, String>)> =
                    Vec::new();
                for handle in handles {
                    if let Ok(result) = handle.await {
                        parallel_results.push(result);
                    }
                }

                // Sort by order_index for deterministic merge
                parallel_results.sort_by_key(|(idx, _, _)| *idx);

                // Merge all extracted variables into main ctx
                let mut any_failed = false;
                for (_, result, step_ctx) in &parallel_results {
                    // Merge variables from this step's ctx that aren't in the snapshot
                    for (k, v) in step_ctx {
                        if !ctx_snapshot.contains_key(k) {
                            ctx.insert(k.clone(), v.clone());
                        }
                    }
                    if result.status == "failed" {
                        any_failed = true;
                    }
                    results.push(result.clone());
                }

                let group_status = if any_failed { "failed" } else { "passed" };
                let _ = tx
                    .send(RunEvent::ParallelGroupComplete {
                        step_ids: step_ids.clone(),
                        status: group_status.to_string(),
                    })
                    .await;

                if any_failed {
                    let should_stop = parallel_steps
                        .iter()
                        .zip(parallel_results.iter())
                        .any(|(step, (_, result, _))| {
                            result.status == "failed" && step.on_failure != "CONTINUE"
                        });
                    if should_stop {
                        let _ = tx
                            .send(RunEvent::RunComplete {
                                status: "failed".to_string(),
                            })
                            .await;
                        return (results, "failed".to_string());
                    }
                }
            }
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

    #[allow(dead_code)]
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

    #[test]
    fn test_resolve_iterations_none() {
        let step = Step {
            id: "s1".into(),
            workflow_id: "w1".into(),
            order_index: 0,
            name: "Test".into(),
            method: "GET".into(),
            url: "".into(),
            headers: "[]".into(),
            body: "".into(),
            response_schema: "[]".into(),
            on_success: "CONTINUE".into(),
            on_failure: "STOP".into(),
            loop_type: "none".into(),
            loop_config: "{}".into(),
            parallel_group: None,
        };
        let ctx = HashMap::new();
        let iters = resolve_iterations(&step, &ctx);
        assert_eq!(iters.len(), 1);
        assert!(iters[0].is_none());
    }

    #[test]
    fn test_resolve_iterations_count() {
        let step = Step {
            id: "s1".into(),
            workflow_id: "w1".into(),
            order_index: 0,
            name: "Test".into(),
            method: "GET".into(),
            url: "".into(),
            headers: "[]".into(),
            body: "".into(),
            response_schema: "[]".into(),
            on_success: "CONTINUE".into(),
            on_failure: "STOP".into(),
            loop_type: "count".into(),
            loop_config: r#"{"count": 3}"#.into(),
            parallel_group: None,
        };
        let ctx = HashMap::new();
        let iters = resolve_iterations(&step, &ctx);
        assert_eq!(iters.len(), 3);
        assert!(iters.iter().all(|v| v.is_none()));
    }

    #[test]
    fn test_resolve_iterations_for_each() {
        let step = Step {
            id: "s1".into(),
            workflow_id: "w1".into(),
            order_index: 0,
            name: "Test".into(),
            method: "GET".into(),
            url: "".into(),
            headers: "[]".into(),
            body: "".into(),
            response_schema: "[]".into(),
            on_success: "CONTINUE".into(),
            on_failure: "STOP".into(),
            loop_type: "for_each".into(),
            loop_config: r#"{"source_var": "step1.items"}"#.into(),
            parallel_group: None,
        };
        let mut ctx = HashMap::new();
        ctx.insert("step1.items".to_string(), r#"["a","b","c"]"#.to_string());
        let iters = resolve_iterations(&step, &ctx);
        assert_eq!(iters.len(), 3);
        assert_eq!(iters[0], Some("a".to_string()));
        assert_eq!(iters[1], Some("b".to_string()));
        assert_eq!(iters[2], Some("c".to_string()));
    }

    #[test]
    fn test_resolve_iterations_for_each_objects() {
        let step = Step {
            id: "s1".into(),
            workflow_id: "w1".into(),
            order_index: 0,
            name: "Test".into(),
            method: "GET".into(),
            url: "".into(),
            headers: "[]".into(),
            body: "".into(),
            response_schema: "[]".into(),
            on_success: "CONTINUE".into(),
            on_failure: "STOP".into(),
            loop_type: "for_each".into(),
            loop_config: r#"{"source_var": "step1.data"}"#.into(),
            parallel_group: None,
        };
        let mut ctx = HashMap::new();
        ctx.insert("step1.data".to_string(), r#"[1, 2, 3]"#.to_string());
        let iters = resolve_iterations(&step, &ctx);
        assert_eq!(iters.len(), 3);
        assert_eq!(iters[0], Some("1".to_string()));
        assert_eq!(iters[1], Some("2".to_string()));
        assert_eq!(iters[2], Some("3".to_string()));
    }

    fn make_step(id: &str, order: i64, group: Option<&str>) -> Step {
        Step {
            id: id.into(),
            workflow_id: "w1".into(),
            order_index: order,
            name: format!("Step {}", id),
            method: "GET".into(),
            url: "".into(),
            headers: "[]".into(),
            body: "".into(),
            response_schema: "[]".into(),
            on_success: "CONTINUE".into(),
            on_failure: "STOP".into(),
            loop_type: "none".into(),
            loop_config: "{}".into(),
            parallel_group: group.map(|s| s.to_string()),
        }
    }

    #[test]
    fn test_group_steps_all_sequential() {
        let steps = vec![
            make_step("s1", 0, None),
            make_step("s2", 1, None),
            make_step("s3", 2, None),
        ];
        let units = group_steps(&steps);
        assert_eq!(units.len(), 3);
        assert!(matches!(units[0], ExecutionUnit::Single(_)));
        assert!(matches!(units[1], ExecutionUnit::Single(_)));
        assert!(matches!(units[2], ExecutionUnit::Single(_)));
    }

    #[test]
    fn test_group_steps_parallel_group() {
        let steps = vec![
            make_step("s1", 0, None),
            make_step("s2", 1, Some("group-1")),
            make_step("s3", 2, Some("group-1")),
            make_step("s4", 3, None),
        ];
        let units = group_steps(&steps);
        assert_eq!(units.len(), 3);
        assert!(matches!(units[0], ExecutionUnit::Single(_)));
        match &units[1] {
            ExecutionUnit::Parallel(steps) => assert_eq!(steps.len(), 2),
            _ => panic!("Expected parallel unit"),
        }
        assert!(matches!(units[2], ExecutionUnit::Single(_)));
    }

    #[test]
    fn test_group_steps_single_in_group_becomes_single() {
        let steps = vec![
            make_step("s1", 0, Some("group-1")),
            make_step("s2", 1, None),
        ];
        let units = group_steps(&steps);
        assert_eq!(units.len(), 2);
        assert!(matches!(units[0], ExecutionUnit::Single(_)));
        assert!(matches!(units[1], ExecutionUnit::Single(_)));
    }

    #[test]
    fn test_group_steps_non_consecutive_same_group() {
        let steps = vec![
            make_step("s1", 0, Some("group-1")),
            make_step("s2", 1, None),
            make_step("s3", 2, Some("group-1")),
        ];
        let units = group_steps(&steps);
        // s1 alone with group-1 -> Single, s2 -> Single, s3 alone with group-1 -> Single
        assert_eq!(units.len(), 3);
        assert!(matches!(units[0], ExecutionUnit::Single(_)));
        assert!(matches!(units[1], ExecutionUnit::Single(_)));
        assert!(matches!(units[2], ExecutionUnit::Single(_)));
    }
}
