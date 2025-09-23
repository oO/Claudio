use super::types::*;
use tauri::{AppHandle, Emitter, Manager, command};
use uuid::Uuid;

/// Opens a new Claude Code session
#[command]
pub async fn open_new_session(app: AppHandle, path: Option<String>) -> Result<String, String> {
    log::info!("Opening new Claude Code session at path: {:?}", path);

    let session_id = Uuid::new_v4().to_string();
    let project_path = path.unwrap_or_else(|| std::env::current_dir().unwrap().to_string_lossy().to_string());

    // Emit session started event
    let _ = app.emit("claude-session-started", serde_json::json!({
        "session_id": session_id,
        "project_path": project_path
    }));

    // The user should launch Claude Code through other means or use the execute_claude_code command
    #[cfg(not(debug_assertions))]
    {
        return Err("Session opening in production mode requires using execute_claude_code command".to_string());
    }

    #[cfg(debug_assertions)]
    {
        return Ok(session_id);
    }
}

/// Execute a new interactive Claude Code conversation with streaming output
#[command]
pub async fn execute_claude_code(
    app: AppHandle,
    project_path: String,
    prompt: String,
    model: String,
) -> Result<(), String> {
    log::info!("prompt: {}", prompt);

    let claude_path = find_claude_binary(&app)?;
    let args = vec!["--model".to_string(), model.clone()];

    let cmd = create_system_command(&claude_path, args, &project_path);
    spawn_claude_process(app, cmd, prompt, model, project_path).await
}


/// Resume an existing Claude Code session by ID with streaming output
#[command]
pub async fn resume_claude_code(
    app: AppHandle,
    project_path: String,
    session_id: String,
    prompt: String,
    model: String,
) -> Result<(), String> {
    log::info!("prompt: {}", prompt);

    let claude_path = find_claude_binary(&app)?;
    let args = vec!["--resume".to_string(), session_id, "--model".to_string(), model.clone()];
    
    let cmd = create_system_command(&claude_path, args, &project_path);
    spawn_claude_process(app, cmd, prompt, model, project_path).await
}

/// Cancel the currently running Claude Code execution
#[command]
pub async fn cancel_claude_execution(
    app: AppHandle,
    session_id: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Cancelling Claude Code execution for session: {:?}",
        session_id
    );

    // Try to terminate any running Claude process
    let state = app.state::<ClaudeProcessState>();
    let mut current_child = state.current_process.lock().await;

    if let Some(mut child) = current_child.take() {
        // Try to terminate gracefully first
        let _ = child.kill().await;
        log::info!("Terminated Claude Code process");
        
        // Notify frontend
        let _ = app.emit("claude-execution-cancelled", serde_json::json!({
            "session_id": session_id
        }));
        
        Ok(())
    } else {
        log::warn!("No running Claude Code process to cancel");
        Ok(())
    }
}

/// List all running Claude sessions
#[command]
pub async fn list_running_claude_sessions(
    registry: tauri::State<'_, crate::process::ProcessRegistryState>,
) -> Result<Vec<crate::process::ProcessInfo>, String> {
    registry.inner().0.get_running_claude_sessions()
}

/// Get output for a specific Claude session
#[command]
pub async fn get_claude_session_output(
    registry: tauri::State<'_, crate::process::ProcessRegistryState>,
    session_id: String,
) -> Result<String, String> {
    log::info!("Getting output for Claude session: {}", session_id);
    // Try to find a process that matches the session ID and get its output
    match registry.inner().0.get_claude_session_by_id(&session_id)? {
        Some(process_info) => {
            registry.inner().0.get_live_output(process_info.run_id)
        }
        None => Ok(String::new())
    }
}

/// Helper function to spawn Claude process and handle streaming
async fn spawn_claude_process(app: AppHandle, mut cmd: tokio::process::Command, prompt: String, model: String, project_path: String) -> Result<(), String> {
    use tokio::io::{AsyncBufReadExt, BufReader};

    // Spawn the process
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn Claude: {}", e))?;

    // Get stdout and stderr
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;

    // Generate a unique session ID for this execution
    let session_id = Uuid::new_v4().to_string();
    log::info!("Started Claude execution with session ID: {}", session_id);

    // Store the child process in global state
    let state = app.state::<ClaudeProcessState>();
    {
        let mut current_process = state.current_process.lock().await;
        // Kill any existing process first
        if let Some(mut existing) = current_process.take() {
            let _ = existing.kill().await;
        }
        *current_process = Some(child);
    }

    // Emit session started event
    let _ = app.emit("claude-execution-started", serde_json::json!({
        "session_id": session_id,
        "project_path": project_path,
        "prompt": prompt,
        "model": model
    }));

    // Handle stdout in a separate task
    let app_stdout = app.clone();
    let session_id_stdout = session_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        
        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break; // EOF
            }
            
            // Emit the line to the frontend
            let _ = app_stdout.emit("claude-stdout", serde_json::json!({
                "session_id": session_id_stdout,
                "data": line.trim_end()
            }));
            
            line.clear();
        }
    });

    // Handle stderr in a separate task
    let app_stderr = app.clone();
    let session_id_stderr = session_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut line = String::new();
        
        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break; // EOF
            }
            
            // Emit the line to the frontend
            let _ = app_stderr.emit("claude-stderr", serde_json::json!({
                "session_id": session_id_stderr,
                "data": line.trim_end()
            }));
            
            line.clear();
        }
    });

    // Wait for the process to complete in the background
    let app_wait = app.clone();
    let session_id_wait = session_id.clone();
    tokio::spawn(async move {
        let state = app_wait.state::<ClaudeProcessState>();
        
        // Wait for the process to complete
        let exit_status = {
            let mut current_process = state.current_process.lock().await;
            if let Some(mut child) = current_process.take() {
                child.wait().await
            } else {
                return; // Process was already cleaned up
            }
        };
        
        // Emit completion event
        match exit_status {
            Ok(status) => {
                let _ = app_wait.emit("claude-execution-completed", serde_json::json!({
                    "session_id": session_id_wait,
                    "exit_code": status.code(),
                    "success": status.success()
                }));
                log::info!("Claude execution completed with status: {}", status);
            }
            Err(e) => {
                let _ = app_wait.emit("claude-execution-error", serde_json::json!({
                    "session_id": session_id_wait,
                    "error": e.to_string()
                }));
                log::error!("Claude execution error: {}", e);
            }
        }
    });

    Ok(())
}