use std::collections::HashMap;

#[derive(Debug, PartialEq)]
pub enum EvalError {
    UnknownVariable(String),
    ParseError(String),
}

pub fn evaluate(expr: &str, ctx: &HashMap<String, String>) -> Result<bool, EvalError> {
    let expr = expr.trim();

    // Handle && — all sub-expressions must be true
    if expr.contains(" && ") {
        return expr
            .split(" && ")
            .map(|e| evaluate(e.trim(), ctx))
            .try_fold(true, |acc, r| r.map(|v| acc && v));
    }

    // Handle || — at least one sub-expression must be true
    if expr.contains(" || ") {
        return expr
            .split(" || ")
            .map(|e| evaluate(e.trim(), ctx))
            .try_fold(false, |acc, r| r.map(|v| acc || v));
    }

    // Single comparison — find operator
    let ops = ["==", "!=", ">=", "<=", ">", "<"];
    for op in &ops {
        if let Some(idx) = expr.find(op) {
            let lhs = expr[..idx].trim();
            let rhs_raw = expr[idx + op.len()..].trim();
            // Strip surrounding quotes from RHS if present
            let rhs = rhs_raw.trim_matches('"').trim_matches('\'');

            let lhs_val = ctx
                .get(lhs)
                .ok_or_else(|| EvalError::UnknownVariable(lhs.to_string()))?;

            return Ok(match *op {
                "==" => lhs_val.as_str() == rhs,
                "!=" => lhs_val.as_str() != rhs,
                ">" => lhs_val.parse::<f64>().unwrap_or(0.0)
                    > rhs.parse::<f64>().unwrap_or(0.0),
                "<" => lhs_val.parse::<f64>().unwrap_or(0.0)
                    < rhs.parse::<f64>().unwrap_or(0.0),
                ">=" => lhs_val.parse::<f64>().unwrap_or(0.0)
                    >= rhs.parse::<f64>().unwrap_or(0.0),
                "<=" => lhs_val.parse::<f64>().unwrap_or(0.0)
                    <= rhs.parse::<f64>().unwrap_or(0.0),
                _ => false,
            });
        }
    }

    Err(EvalError::ParseError(format!("Cannot parse expression: {}", expr)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn ctx(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn test_equals_string() {
        let c = ctx(&[("step1.status", "ok")]);
        assert_eq!(evaluate("step1.status == \"ok\"", &c), Ok(true));
    }

    #[test]
    fn test_not_equals() {
        let c = ctx(&[("step1.amount", "0")]);
        assert_eq!(evaluate("step1.amount != \"0\"", &c), Ok(false));
    }

    #[test]
    fn test_numeric_greater_than() {
        let c = ctx(&[("step1.count", "5")]);
        assert_eq!(evaluate("step1.count > 3", &c), Ok(true));
    }

    #[test]
    fn test_numeric_less_than() {
        let c = ctx(&[("step1.price", "9.99")]);
        assert_eq!(evaluate("step1.price < 10", &c), Ok(true));
    }

    #[test]
    fn test_and_operator() {
        let c = ctx(&[("step1.ok", "true"), ("step2.ready", "true")]);
        assert_eq!(evaluate("step1.ok == \"true\" && step2.ready == \"true\"", &c), Ok(true));
    }

    #[test]
    fn test_or_operator() {
        let c = ctx(&[("step1.status", "error")]);
        assert_eq!(evaluate("step1.status == \"ok\" || step1.status == \"error\"", &c), Ok(true));
    }

    #[test]
    fn test_unknown_var_returns_err() {
        let c = ctx(&[]);
        assert!(evaluate("unknown.var == \"x\"", &c).is_err());
    }

    #[test]
    fn test_zero_condition() {
        let c = ctx(&[("step1.amount", "0")]);
        assert_eq!(evaluate("step1.amount == \"0\"", &c), Ok(true));
    }
}
