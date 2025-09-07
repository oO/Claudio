use serde_json::Value;
use tauri::command;

/// Frontend logging command that respects log levels
#[command]
pub async fn log_frontend_debug(component: String, data: Value) -> Result<(), String> {
    // Extract the actual arguments from the structured data
    let log_message = if let Some(args) = data.get("args").and_then(|v| v.as_array()) {
        args.iter()
            .map(|arg| {
                if arg.is_string() {
                    arg.as_str().unwrap_or("").to_string()
                } else {
                    serde_json::to_string(arg).unwrap_or_else(|_| "[object]".to_string())
                }
            })
            .collect::<Vec<String>>()
            .join(" ")
    } else {
        serde_json::to_string(&data).unwrap_or_else(|_| "Failed to serialize data".to_string())
    };
    
    // Extract log level from component name or data structure
    let level = if let Some(level_str) = data.get("level").and_then(|v| v.as_str()) {
        level_str.to_uppercase()
    } else if component.contains(":ERROR") {
        "ERROR".to_string()
    } else if component.contains(":WARN") {
        "WARN".to_string()
    } else if component.contains(":DEBUG") {
        "DEBUG".to_string()
    } else if component.contains(":INFO") {
        "INFO".to_string()
    } else {
        "INFO".to_string() // Default to info level
    };
    
    // Clean component name (remove level suffix if present)
    let clean_component = component.split(':').next().unwrap_or(&component);
    
    // Log with appropriate level
    match level.as_str() {
        "ERROR" => log::error!("[{}] {}", clean_component, log_message),
        "WARN" => log::warn!("[{}] {}", clean_component, log_message),
        "DEBUG" => log::debug!("[{}] {}", clean_component, log_message),
        _ => log::info!("[{}] {}", clean_component, log_message),
    }
    
    Ok(())
}