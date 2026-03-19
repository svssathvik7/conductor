use std::collections::HashMap;

pub fn interpolate(template: &str, ctx: &HashMap<String, String>) -> String {
    let mut result = template.to_string();
    for (key, value) in ctx {
        let placeholder = format!("{{{{{}}}}}", key);
        result = result.replace(&placeholder, value);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_simple_interpolation() {
        let mut ctx = HashMap::new();
        ctx.insert("base_url".to_string(), "https://api.example.com".to_string());
        let result = interpolate("{{base_url}}/orders", &ctx);
        assert_eq!(result, "https://api.example.com/orders");
    }

    #[test]
    fn test_step_var_interpolation() {
        let mut ctx = HashMap::new();
        ctx.insert("step1.token".to_string(), "abc123".to_string());
        let result = interpolate("Bearer {{step1.token}}", &ctx);
        assert_eq!(result, "Bearer abc123");
    }

    #[test]
    fn test_missing_var_stays_as_is() {
        let ctx = HashMap::new();
        let result = interpolate("{{unknown}}", &ctx);
        assert_eq!(result, "{{unknown}}");
    }

    #[test]
    fn test_multiple_vars() {
        let mut ctx = HashMap::new();
        ctx.insert("host".to_string(), "api.example.com".to_string());
        ctx.insert("id".to_string(), "42".to_string());
        let result = interpolate("https://{{host}}/items/{{id}}", &ctx);
        assert_eq!(result, "https://api.example.com/items/42");
    }

    #[test]
    fn test_empty_template() {
        let ctx = HashMap::new();
        let result = interpolate("", &ctx);
        assert_eq!(result, "");
    }
}
