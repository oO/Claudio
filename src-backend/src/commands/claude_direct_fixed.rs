use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::{command, AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeDirectOptions {
    pub max_turns: Option<u32>,
    pub custom_system_prompt: Option<String>,
    pub allowed_tools: Option<Vec<String>>,
    pub working_directory: Option<String>,
    pub previous_session_id: Option<String>, // For --resume functionality
}

/// Call Claude CLI directly and keep process alive until completion
#[command]
pub async fn start_claude_direct_session(
    app: AppHandle,
    session_id: String,
    project_path: String,
    prompt: String,
    options: ClaudeDirectOptions,
) -> Result<(), String> {
    log::info!("Starting Claude CLI direct session: {} at {}", session_id, project_path);

    // Build command arguments
    let mut claude_args = vec![
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--print".to_string(),
    ];

    // Add --resume if we have a previous session ID
    if let Some(prev_session_id) = &options.previous_session_id {
        claude_args.push("--resume".to_string());
        claude_args.push(prev_session_id.clone());
        log::info!("Resuming conversation from session: {}", prev_session_id);
    }

    // Add the prompt
    claude_args.push("--".to_string());
    claude_args.push(prompt);

    log::info!("Calling Claude CLI: claude {}", claude_args.join(" "));

    // Execute claude CLI directly - keep reference alive
    let mut child = Command::new("claude")
        .args(&claude_args)
        .current_dir(options.working_directory.as_ref().unwrap_or(&project_path))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Claude CLI process: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;

    // Process streams and wait for completion in parallel
    let app_clone = app.clone();
    let session_id_clone = session_id.clone();
    let project_path_clone = project_path.clone();
    let previous_session_id = options.previous_session_id.clone();
    
    let stdout_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        let mut new_session_id: Option<String> = None;

        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break;
            }

            if line.trim().is_empty() {
                line.clear();
                continue;
            }

            // Try to parse each line as streaming JSON from Claude CLI
            if let Ok(message) = serde_json::from_str::<serde_json::Value>(&line.trim()) {
                log::info!("Claude CLI output: {}", serde_json::to_string_pretty(&message).unwrap_or_else(|_| "Invalid JSON".to_string()));
                
                // Extract the new session ID from system message for session tracking
                if message.get("type") == Some(&serde_json::Value::String("system".to_string())) {
                    if let Some(claude_session_id) = message.get("session_id") {
                        if let Some(id_str) = claude_session_id.as_str() {
                            new_session_id = Some(id_str.to_string());
                            log::info!("🆔 New Claude session ID: {}", id_str);
                        }
                    }
                }
                
                // Emit the raw message to frontend for parsing
                let _ = app_clone.emit("claude-stream", line.trim());
            } else {
                log::warn!("Claude CLI non-JSON output: {}", line.trim());
            }

            line.clear();
        }

        // Cleanup previous session file for conversation chaining
        if let (Some(prev_id), Some(new_id)) = (previous_session_id, &new_session_id) {
            log::info!("📝 Session continued: {} -> {}", prev_id, new_id);
            
            if let Some(home_dir) = dirs::home_dir() {
                let project_encoded = project_path_clone.replace("/", "-");
                let prev_session_file = home_dir
                    .join(".claude")
                    .join("projects")
                    .join(project_encoded)
                    .join(format!("{}.jsonl", prev_id));
                
                if prev_session_file.exists() {
                    match tokio::fs::remove_file(&prev_session_file).await {
                        Ok(_) => log::info!("🗑️ Cleaned up previous session file in chain: {}", prev_id),
                        Err(e) => log::warn!("Failed to delete previous session file: {}", e),
                    }
                }
            }
        }

        log::info!("Claude CLI stdout completed: {}", session_id_clone);
        new_session_id
    });

    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut line = String::new();

        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break;
            }
            log::warn!("Claude CLI stderr: {}", line.trim());
            line.clear();
        }
    });

    // Wait for the process to complete
    let status = child.wait().await
        .map_err(|e| format!("Failed to wait for Claude CLI process: {}", e))?;
    
    log::info!("Claude CLI completed with status: {:?}", status);

    // Wait for both stdout and stderr tasks to complete
    let (stdout_result, _) = tokio::join!(stdout_task, stderr_task);
    
    // Emit completion event
    let _ = app.emit(
        &format!("claude-sdk-completed:{}", session_id),
        serde_json::json!({
            "success": status.success(),
            "code": status.code(),
            "session_id": stdout_result.unwrap_or(None)
        })
    );

    if !status.success() {
        return Err(format!("Claude CLI exited with status: {:?}", status));
    }

    Ok(())
}