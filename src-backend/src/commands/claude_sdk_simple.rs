use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSDKOptions {
    pub max_turns: Option<u32>,
    pub custom_system_prompt: Option<String>,
    pub allowed_tools: Option<Vec<String>>,
    pub working_directory: Option<String>,
    pub previous_session_id: Option<String>,
    pub claudio_id: Option<String>,
}

/// Start a new Claude Code session - redirects to direct CLI approach
#[command]
pub async fn start_claude_sdk_session(
    app: AppHandle,
    session_id: String,
    project_path: String,
    prompt: String,
    options: ClaudeSDKOptions,
) -> Result<(), String> {
    
    // Convert SDK options to direct CLI options
    use crate::commands::claude_direct::{start_claude_direct_session, ClaudeDirectOptions};
    
    let direct_options = ClaudeDirectOptions {
        max_turns: options.max_turns,
        custom_system_prompt: options.custom_system_prompt,
        allowed_tools: options.allowed_tools,
        working_directory: options.working_directory,
        session_id: options.previous_session_id,
        claudio_id: options.claudio_id, // Pass through the existing claudio_id
    };
    
    // Call the direct CLI function instead of the broken Node.js approach
    start_claude_direct_session(app, session_id, project_path, prompt, direct_options).await
}

/// Continue a Claude SDK conversation - placeholder for now
#[command]
pub async fn continue_claude_sdk_session(
    _app: AppHandle,
    _session_id: String,
    _project_path: String,
    _prompt: String,
    _options: ClaudeSDKOptions,
) -> Result<(), String> {
    Err("continue_claude_sdk_session not implemented yet".to_string())
}

/// Resume a Claude SDK conversation - placeholder for now  
#[command]
pub async fn resume_claude_sdk_session(
    _app: AppHandle,
    _session_id: String,
    _project_path: String,
    _prompt: String,
    _claude_session_id: String,
    _options: ClaudeSDKOptions,
) -> Result<(), String> {
    Err("resume_claude_sdk_session not implemented yet".to_string())
}

/// Terminate a Claude SDK session - placeholder for now
#[command]
pub async fn terminate_claude_sdk_session(_session_id: String) -> Result<(), String> {
    log::info!("Terminating Claude SDK session (no-op)");
    Ok(())
}