use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::{command, AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
// use uuid::Uuid; // Unused for now, keeping for future use

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSDKOptions {
    pub max_turns: Option<u32>,
    pub custom_system_prompt: Option<String>,
    pub allowed_tools: Option<Vec<String>>,
    pub working_directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSDKMessage {
    pub r#type: String,
    pub content: serde_json::Value,
    pub session_id: String,
}

/// Start a new Claude Code SDK session - now redirects to direct CLI approach
#[command]
pub async fn start_claude_sdk_session(
    app: AppHandle,
    session_id: String,
    project_path: String,
    prompt: String,
    options: ClaudeSDKOptions,
) -> Result<(), String> {
    log::info!("Redirecting to direct Claude CLI approach: {} at {}", session_id, project_path);
    
    // Convert SDK options to direct CLI options
    use crate::commands::claude_direct::{start_claude_direct_session, ClaudeDirectOptions};
    
    let direct_options = ClaudeDirectOptions {
        max_turns: options.max_turns,
        custom_system_prompt: options.custom_system_prompt,
        allowed_tools: options.allowed_tools,
        working_directory: options.working_directory,
    };
    
    // Call the direct CLI function instead
    start_claude_direct_session(app, session_id, project_path, prompt, direct_options).await

    // Write script to Claudio's temp directory for proper module resolution
    let temp_dir = claudio_project_path.join("temp");
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    let script_path = temp_dir.join(format!("claude_sdk_{}.mjs", session_id));
    
    tokio::fs::write(&script_path, script_content)
        .await
        .map_err(|e| format!("Failed to write temp script: {}", e))?;

    // Execute the Node.js script from the Claudio directory for module resolution
    let mut cmd = Command::new("node")
        .arg(&script_path)
        .current_dir(&claudio_project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Node.js process: {}", e))?;

    let stdout = cmd.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = cmd.stderr.take().ok_or("Failed to get stderr")?;

    // Handle stdout in background task
    let app_stdout = app.clone();
    let session_id_stdout = session_id.clone();
    let script_path_cleanup = script_path.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();

        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break;
            }

            // Try to parse the line as JSON message
            if let Ok(message) = serde_json::from_str::<serde_json::Value>(&line.trim()) {
                // Debug: Log the message structure to understand the format
                log::info!("Claude SDK message: {}", serde_json::to_string_pretty(&message).unwrap_or_else(|_| "Invalid JSON".to_string()));
                
                // Handle debug messages specifically
                if message.get("type") == Some(&serde_json::Value::String("claude_sdk_debug".to_string())) {
                    if let Some(debug_msg) = message.get("message") {
                        log::info!("🔍 Claude SDK Debug: {}", debug_msg.as_str().unwrap_or(""));
                    }
                }
                
                // Extract and preserve the actual Claude session ID
                let mut enriched_message = message.clone();
                if let Some(msg) = message.get("message") {
                    if msg.get("type") == Some(&serde_json::Value::String("system".to_string())) {
                        if let Some(claude_session_id) = msg.get("session_id") {
                            // Add the actual Claude session ID to our message for tracking
                            enriched_message.as_object_mut().unwrap().insert(
                                "claude_session_id".to_string(),
                                claude_session_id.clone()
                            );
                            log::info!("Captured Claude session ID: {}", claude_session_id);
                        }
                    }
                }
                let _ = app_stdout.emit(&format!("claude-sdk-message:{}", session_id_stdout), enriched_message);
            }

            line.clear();
        }

        // Clean up temp file
        let _ = tokio::fs::remove_file(&script_path_cleanup).await;
        log::info!("Claude SDK session completed: {}", session_id_stdout);
    });

    // Handle stderr in background task
    let app_stderr = app.clone();
    let session_id_stderr = session_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut line = String::new();

        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break;
            }

            if !line.trim().is_empty() {
                log::error!("Claude SDK stderr: {}", line.trim());
                let _ = app_stderr.emit(
                    &format!("claude-sdk-error:{}", session_id_stderr),
                    serde_json::json!({
                        "error": line.trim()
                    })
                );
            }

            line.clear();
        }
    });

    // Wait for process to complete in background
    let app_wait = app.clone();
    let session_id_wait = session_id.clone();
    tokio::spawn(async move {
        match cmd.wait().await {
            Ok(status) => {
                log::info!("Claude SDK process completed with status: {:?}", status);
                let _ = app_wait.emit(
                    &format!("claude-sdk-completed:{}", session_id_wait),
                    serde_json::json!({
                        "success": status.success(),
                        "code": status.code()
                    })
                );
            }
            Err(e) => {
                log::error!("Claude SDK process error: {}", e);
                let _ = app_wait.emit(
                    &format!("claude-sdk-error:{}", session_id_wait),
                    serde_json::json!({
                        "error": e.to_string()
                    })
                );
            }
        }
    });

    Ok(())
}

/// Continue a Claude SDK conversation with a new prompt (using --continue flag)
#[command]
pub async fn continue_claude_sdk_session(
    app: AppHandle,
    session_id: String,
    project_path: String,
    prompt: String,
    options: ClaudeSDKOptions,
) -> Result<(), String> {
    log::info!("Continuing Claude SDK conversation with --continue flag: {}", session_id);

    // Get the path to Claudio's directory for module resolution
    let claudio_project_path = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;

    // Create a Node.js script using continue: true (which passes --continue flag)
    let script_content = format!(
        r#"
import {{ query }} from '@anthropic-ai/claude-code';

const sessionId = '{}';
const prompt = `{}`;

const options = {{
    continue: true,  // This passes --continue flag to continue most recent conversation
    maxTurns: {},
    customSystemPrompt: {},
    allowedTools: {},
    cwd: '{}'
}};

try {{
    for await (const message of query({{ prompt, options }})) {{
        console.log(JSON.stringify({{
            type: 'claude_sdk_message',
            session_id: sessionId,
            message: message
        }}));
    }}
}} catch (error) {{
    console.log(JSON.stringify({{
        type: 'claude_sdk_error',
        session_id: sessionId,
        error: error.message
    }}));
}}
"#,
        session_id,
        prompt.replace('`', r#"\`"#),
        options.max_turns.unwrap_or(5),
        options.custom_system_prompt.as_ref()
            .map(|s| format!("'{}'", s.replace('\'', r#"\'"#)))
            .unwrap_or_else(|| "null".to_string()),
        serde_json::to_string(&options.allowed_tools.unwrap_or_else(|| vec!["Bash".to_string(), "Read".to_string(), "Write".to_string()]))
            .unwrap_or_else(|_| "[]".to_string()),
        options.working_directory.as_ref()
            .map(|s| s.replace('\'', r#"\'"#))
            .unwrap_or_else(|| project_path.clone())
    );

    // Write script to Claudio's temp directory for proper module resolution
    let temp_dir = claudio_project_path.join("temp");
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    let script_path = temp_dir.join(format!("claude_sdk_continue_{}.mjs", session_id));
    
    tokio::fs::write(&script_path, script_content)
        .await
        .map_err(|e| format!("Failed to write temp script: {}", e))?;

    // Execute the Node.js script from the Claudio directory for module resolution
    let mut cmd = Command::new("node")
        .arg(&script_path)
        .current_dir(&claudio_project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Node.js process: {}", e))?;

    let stdout = cmd.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = cmd.stderr.take().ok_or("Failed to get stderr")?;

    // Handle stdout in background task
    let app_stdout = app.clone();
    let session_id_stdout = session_id.clone();
    let script_path_cleanup = script_path.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();

        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break;
            }

            // Try to parse the line as JSON message
            if let Ok(message) = serde_json::from_str::<serde_json::Value>(&line.trim()) {
                // Debug: Log the message structure to understand the format
                log::info!("Claude SDK message: {}", serde_json::to_string_pretty(&message).unwrap_or_else(|_| "Invalid JSON".to_string()));
                
                // Handle debug messages specifically
                if message.get("type") == Some(&serde_json::Value::String("claude_sdk_debug".to_string())) {
                    if let Some(debug_msg) = message.get("message") {
                        log::info!("🔍 Claude SDK Debug: {}", debug_msg.as_str().unwrap_or(""));
                    }
                }
                
                // Extract and preserve the actual Claude session ID
                let mut enriched_message = message.clone();
                if let Some(msg) = message.get("message") {
                    if msg.get("type") == Some(&serde_json::Value::String("system".to_string())) {
                        if let Some(claude_session_id) = msg.get("session_id") {
                            // Add the actual Claude session ID to our message for tracking
                            enriched_message.as_object_mut().unwrap().insert(
                                "claude_session_id".to_string(),
                                claude_session_id.clone()
                            );
                            log::info!("Captured Claude session ID: {}", claude_session_id);
                        }
                    }
                }
                let _ = app_stdout.emit(&format!("claude-sdk-message:{}", session_id_stdout), enriched_message);
            }

            line.clear();
        }

        // Clean up temp file
        let _ = tokio::fs::remove_file(&script_path_cleanup).await;
        log::info!("Claude SDK continuation completed: {}", session_id_stdout);
    });

    // Handle stderr in background task
    let app_stderr = app.clone();
    let session_id_stderr = session_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut line = String::new();

        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break;
            }

            if !line.trim().is_empty() {
                log::error!("Claude SDK stderr: {}", line.trim());
                let _ = app_stderr.emit(
                    &format!("claude-sdk-error:{}", session_id_stderr),
                    serde_json::json!({
                        "error": line.trim()
                    })
                );
            }

            line.clear();
        }
    });

    // Wait for process to complete in background
    let app_wait = app.clone();
    let session_id_wait = session_id.clone();
    tokio::spawn(async move {
        match cmd.wait().await {
            Ok(status) => {
                log::info!("Claude SDK process completed with status: {:?}", status);
                let _ = app_wait.emit(
                    &format!("claude-sdk-completed:{}", session_id_wait),
                    serde_json::json!({
                        "success": status.success(),
                        "code": status.code()
                    })
                );
            }
            Err(e) => {
                log::error!("Claude SDK process error: {}", e);
                let _ = app_wait.emit(
                    &format!("claude-sdk-error:{}", session_id_wait),
                    serde_json::json!({
                        "error": e.to_string()
                    })
                );
            }
        }
    });

    Ok(())
}

/// Resume a Claude SDK conversation using a previous Claude session ID
#[command]
pub async fn resume_claude_sdk_session(
    app: AppHandle,
    session_id: String,
    project_path: String,
    prompt: String,
    claude_session_id: String,
    options: ClaudeSDKOptions,
) -> Result<(), String> {
    log::info!("Resuming Claude SDK conversation: {} with Claude session: {}", session_id, claude_session_id);

    // Get the path to Claudio's directory for module resolution
    let claudio_project_path = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;

    // Create a Node.js script using resume: claude_session_id
    let script_content = format!(
        r#"
import {{ query }} from '@anthropic-ai/claude-code';

const sessionId = '{}';
const prompt = `{}`;

const options = {{
    resume: '{}',
    maxTurns: {},
    customSystemPrompt: {},
    allowedTools: {},
    cwd: '{}'
}};

try {{
    for await (const message of query({{ prompt, options }})) {{
        console.log(JSON.stringify({{
            type: 'claude_sdk_message',
            session_id: sessionId,
            message: message
        }}));
    }}
}} catch (error) {{
    console.log(JSON.stringify({{
        type: 'claude_sdk_error',
        session_id: sessionId,
        error: error.message
    }}));
}}
"#,
        session_id,
        prompt.replace('`', r#"\`"#),
        claude_session_id,
        options.max_turns.unwrap_or(5),
        options.custom_system_prompt.as_ref()
            .map(|s| format!("'{}'", s.replace('\'', r#"\'"#)))
            .unwrap_or_else(|| "null".to_string()),
        serde_json::to_string(&options.allowed_tools.unwrap_or_else(|| vec!["Bash".to_string(), "Read".to_string(), "Write".to_string()]))
            .unwrap_or_else(|_| "[]".to_string()),
        options.working_directory.as_ref()
            .map(|s| s.replace('\'', r#"\'"#))
            .unwrap_or_else(|| project_path.clone())
    );

    // Write script to Claudio's temp directory for proper module resolution
    let temp_dir = claudio_project_path.join("temp");
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    let script_path = temp_dir.join(format!("claude_sdk_resume_{}.mjs", session_id));
    
    tokio::fs::write(&script_path, script_content)
        .await
        .map_err(|e| format!("Failed to write temp script: {}", e))?;

    // Execute the Node.js script from the Claudio directory for module resolution
    let mut cmd = Command::new("node")
        .arg(&script_path)
        .current_dir(&claudio_project_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Node.js process: {}", e))?;

    let stdout = cmd.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = cmd.stderr.take().ok_or("Failed to get stderr")?;

    // Handle stdout in background task (same pattern as other commands)
    let app_stdout = app.clone();
    let session_id_stdout = session_id.clone();
    let script_path_cleanup = script_path.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();

        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break;
            }

            // Try to parse the line as JSON message
            if let Ok(message) = serde_json::from_str::<serde_json::Value>(&line.trim()) {
                // Debug: Log the message structure to understand the format
                log::info!("Claude SDK message: {}", serde_json::to_string_pretty(&message).unwrap_or_else(|_| "Invalid JSON".to_string()));
                
                // Handle debug messages specifically
                if message.get("type") == Some(&serde_json::Value::String("claude_sdk_debug".to_string())) {
                    if let Some(debug_msg) = message.get("message") {
                        log::info!("🔍 Claude SDK Debug: {}", debug_msg.as_str().unwrap_or(""));
                    }
                }
                
                // Extract and preserve the actual Claude session ID
                let mut enriched_message = message.clone();
                if let Some(msg) = message.get("message") {
                    if msg.get("type") == Some(&serde_json::Value::String("system".to_string())) {
                        if let Some(claude_session_id) = msg.get("session_id") {
                            // Add the actual Claude session ID to our message for tracking
                            enriched_message.as_object_mut().unwrap().insert(
                                "claude_session_id".to_string(),
                                claude_session_id.clone()
                            );
                            log::info!("Captured Claude session ID: {}", claude_session_id);
                        }
                    }
                }
                let _ = app_stdout.emit(&format!("claude-sdk-message:{}", session_id_stdout), enriched_message);
            }

            line.clear();
        }

        // Clean up temp file
        let _ = tokio::fs::remove_file(&script_path_cleanup).await;
        log::info!("Claude SDK resume completed: {}", session_id_stdout);
    });

    // Handle stderr and wait for completion (same pattern as other commands)
    let app_stderr = app.clone();
    let session_id_stderr = session_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut line = String::new();

        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break;
            }

            if !line.trim().is_empty() {
                log::error!("Claude SDK stderr: {}", line.trim());
                let _ = app_stderr.emit(
                    &format!("claude-sdk-error:{}", session_id_stderr),
                    serde_json::json!({
                        "error": line.trim()
                    })
                );
            }

            line.clear();
        }
    });

    let app_wait = app.clone();
    let session_id_wait = session_id.clone();
    tokio::spawn(async move {
        match cmd.wait().await {
            Ok(status) => {
                log::info!("Claude SDK process completed with status: {:?}", status);
                let _ = app_wait.emit(
                    &format!("claude-sdk-completed:{}", session_id_wait),
                    serde_json::json!({
                        "success": status.success(),
                        "code": status.code()
                    })
                );
            }
            Err(e) => {
                log::error!("Claude SDK process error: {}", e);
                let _ = app_wait.emit(
                    &format!("claude-sdk-error:{}", session_id_wait),
                    serde_json::json!({
                        "error": e.to_string()
                    })
                );
            }
        }
    });

    Ok(())
}

/// Terminate a Claude SDK session
#[command]
pub async fn terminate_claude_sdk_session(session_id: String) -> Result<(), String> {
    log::info!("Terminating Claude SDK session: {}", session_id);
    
    // Since each query is independent, there's no persistent process to terminate
    // This command exists for API compatibility but doesn't need to do anything
    Ok(())
}