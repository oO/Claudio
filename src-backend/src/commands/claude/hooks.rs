use super::types::*;
use std::fs;
use tauri::command;
use crate::paths::{claude_project_dir, CLAUDE_HOOKS_FILE};

/// Gets hooks configuration from settings at specified scope
#[command]
pub async fn get_hooks_config(scope: String, project_path: Option<String>) -> Result<serde_json::Value, String> {
    log::info!("Getting hooks config for scope: {}", scope);

    let config_path = match scope.as_str() {
        "global" => {
            let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
            claude_dir.join("hooks.json")
        }
        "project" => {
            if let Some(path) = project_path {
                claude_project_dir(std::path::Path::new(&path)).join(CLAUDE_HOOKS_FILE)
            } else {
                return Err("Project path required for project scope".to_string());
            }
        }
        _ => return Err(format!("Invalid scope: {}", scope)),
    };

    if !config_path.exists() {
        return Ok(serde_json::json!({
            "pre_prompt": [],
            "post_response": [],
            "on_error": [],
            "on_completion": []
        }));
    }

    let contents = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read hooks config: {}", e))?;

    let config: serde_json::Value = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse hooks config: {}", e))?;

    Ok(config)
}

/// Updates hooks configuration at specified scope
#[command]
pub async fn update_hooks_config(
    scope: String,
    project_path: Option<String>,
    config: serde_json::Value,
) -> Result<String, String> {
    log::info!("Updating hooks config for scope: {}", scope);

    let config_path = match scope.as_str() {
        "global" => {
            let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
            claude_dir.join("hooks.json")
        }
        "project" => {
            if let Some(path) = project_path {
                let project_config_dir = claude_project_dir(std::path::Path::new(&path));
                fs::create_dir_all(&project_config_dir)
                    .map_err(|e| format!("Failed to create project config directory: {}", e))?;
                project_config_dir.join("hooks.json")
            } else {
                return Err("Project path required for project scope".to_string());
            }
        }
        _ => return Err(format!("Invalid scope: {}", scope)),
    };

    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize hooks config: {}", e))?;

    fs::write(&config_path, config_json)
        .map_err(|e| format!("Failed to write hooks config: {}", e))?;

    Ok("Hooks configuration updated successfully".to_string())
}

/// Validates a hook command to ensure it's safe to execute
#[command]
pub async fn validate_hook_command(command: String) -> Result<serde_json::Value, String> {
    log::info!("Validating hook command: {}", command);

    // Basic validation rules
    let mut issues = Vec::new();
    let mut warnings = Vec::new();

    // Check for potentially dangerous commands
    let dangerous_commands = [
        "rm", "del", "format", "mkfs", "dd", "sudo", "su",
        "chmod 777", "chown", "curl", "wget", "nc", "netcat"
    ];

    for dangerous in &dangerous_commands {
        if command.to_lowercase().contains(dangerous) {
            warnings.push(format!("Command contains potentially dangerous operation: {}", dangerous));
        }
    }

    // Check for shell operators that might be risky
    if command.contains("&&") || command.contains("||") || command.contains(";") {
        warnings.push("Command contains shell operators - ensure proper escaping".to_string());
    }

    // Check for environment variable access
    if command.contains("$") {
        warnings.push("Command accesses environment variables".to_string());
    }

    // Check command length
    if command.len() > 1000 {
        issues.push("Command is very long - consider breaking it down".to_string());
    }

    // Check if command is empty
    if command.trim().is_empty() {
        issues.push("Command cannot be empty".to_string());
    }

    let is_valid = issues.is_empty();

    Ok(serde_json::json!({
        "valid": is_valid,
        "issues": issues,
        "warnings": warnings,
        "command": command
    }))
}