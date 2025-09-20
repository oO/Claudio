use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::{command, AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use crate::commands::claudio_storage::{
    update_claudio_session, SessionStatus, ClaudioSession
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeDirectOptions {
    pub max_turns: Option<u32>,
    pub custom_system_prompt: Option<String>,
    pub allowed_tools: Option<Vec<String>>,
    pub working_directory: Option<String>,
    pub session_id: Option<String>,    // Claude CLI session ID for --resume
    pub claudio_id: Option<String>,    // Claudio wrapper session ID
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeProcessEvent {
    pub claudio_session_id: String,
    pub claude_session_id: String, 
    pub process_id: Option<u32>,
    pub status: ClaudeProcessStatus,
    pub timestamp: i64,
    pub title: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ClaudeProcessStatus {
    Starting { action: String },
    Running { action: String },
    Completed,
    Failed { reason: String },
}

/// Get a random thinking title and message (haiku) pair
pub fn get_thinking_content() -> (String, String) {
    let title = get_random_thinking_title();
    let message = get_random_thinking_message();
    (title, message)
}

/// Get a random thinking title from embedded resource
fn get_random_thinking_title() -> String {
    let titles = load_thinking_titles_from_file().expect("Embedded resource should always be available");
    
    use rand::seq::SliceRandom;
    titles.choose(&mut rand::thread_rng())
        .cloned()
        .expect("Should have at least one thinking title")
}

/// Get a random thinking message (haiku) from embedded resource
fn get_random_thinking_message() -> String {
    let messages = load_thinking_messages_from_file().expect("Embedded resource should always be available");
    
    use rand::seq::SliceRandom;
    messages.choose(&mut rand::thread_rng())
        .cloned()
        .expect("Should have at least one thinking message")
}

/// Load thinking titles from embedded resource
fn load_thinking_titles_from_file() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let content = include_str!("../../resources/claude_thinking_titles.txt");
    
    let titles: Vec<String> = content
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();
    
    log::debug!("Loaded {} thinking titles from embedded resource", titles.len());
    Ok(titles)
}

/// Load thinking messages (haikus) from embedded resource
fn load_thinking_messages_from_file() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let content = include_str!("../../resources/claude_thinking_messages.txt");
    
    let messages: Vec<String> = content
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();
    
    log::debug!("Loaded {} thinking messages from embedded resource", messages.len());
    Ok(messages)
}

/// Emit a Claude process event to the frontend
fn emit_process_event(
    app_handle: &AppHandle,
    claudio_session_id: &str,
    claude_session_id: &str,
    process_id: Option<u32>,
    status: ClaudeProcessStatus,
    title: Option<String>,
    message: Option<String>,
) -> Result<(), String> {
    let event = ClaudeProcessEvent {
        claudio_session_id: claudio_session_id.to_string(),
        claude_session_id: claude_session_id.to_string(),
        process_id,
        status,
        timestamp: chrono::Utc::now().timestamp_millis(),
        title,
        message,
    };
    
    app_handle.emit("claude-process-event", &event)
        .map_err(|e| format!("Failed to emit process event: {}", e))?;
    
    log::debug!("Process event emitted successfully");
    Ok(())
}

/// Call Claude CLI directly instead of going through Node.js SDK wrapper
#[command]
pub async fn start_claude_direct_session(
    app: AppHandle,
    temp_session_id: String,   // Temporary ID for this function call (can be ignored)
    project_path: String,
    prompt: String,
    options: ClaudeDirectOptions,
) -> Result<(), String> {
    log::debug!("Starting Claude CLI session: claudio_id={:?}, session_id={:?}", 
               options.claudio_id, options.session_id);
               
    // Emit ACTIVE status for Claudio sessions (equivalent to UserPromptSubmit hook)
    if let Some(claudio_id) = &options.claudio_id {
        emit_claudio_session_status(&app, claudio_id, &project_path, "active").await;
    }
    
    let session_id = options.session_id.as_ref();
    let claudio_id = options.claudio_id.as_ref();
    

    // Simple 2-case logic based on what IDs we have
    let (claudio_session_id, use_resume) = match (claudio_id, session_id) {
        (None, None) => {
            // Case 1: Fresh start - create new Claudio session
            // Fresh start
            let new_claudio_id = format!("claudio-{}", chrono::Utc::now().timestamp_millis());
            
            let new_session = ClaudioSession {
                claudio_id: new_claudio_id.clone(),
                project_path: project_path.clone(),
                current_session: None, // Will be populated when turn completes
                status: SessionStatus::Active,
                session_history: Vec::new(),
            };
            
            update_claudio_session(new_claudio_id.clone(), project_path.clone(), new_session).await
                .map_err(|e| format!("Failed to create Claudio session: {}", e))?;
                
            (new_claudio_id, false) // No --resume
        },
        
        (None, Some(_session_id)) => {
            // Bonus Case: Fork existing Claude session - create new Claudio session but use --resume
            // Forking existing session
            let new_claudio_id = format!("claudio-{}", chrono::Utc::now().timestamp_millis());
            
            let new_session = ClaudioSession {
                claudio_id: new_claudio_id.clone(),
                project_path: project_path.clone(),
                current_session: None, // Will be populated when turn completes
                status: SessionStatus::Active,
                session_history: Vec::new(),
            };
            
            update_claudio_session(new_claudio_id.clone(), project_path.clone(), new_session).await
                .map_err(|e| format!("Failed to create Claudio session: {}", e))?;
                
            (new_claudio_id, true) // Use --resume
        },
        
        (Some(claudio_id), Some(_session_id)) => {
            // Case 2: Continue conversation - update existing Claudio session
            // Continue conversation
            (claudio_id.clone(), true) // Use --resume
        },
        
        (Some(claudio_id), None) => {
            // Case 1: Fresh start with existing Claudio session
            // Fresh start with existing Claudio session
            (claudio_id.clone(), false) // No --resume
        }
    };

    // Build command arguments
    let mut claude_args = vec![
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--print".to_string(),
    ];

    // Add --resume if we should continue a conversation
    if use_resume {
        if let Some(session_id) = &options.session_id {
            claude_args.push("--resume".to_string());
            claude_args.push(session_id.clone());
            log::debug!("Using --resume {}", session_id);
        } else {
            return Err("Logic error: use_resume=true but no session_id provided".to_string());
        }
    } else {
        log::debug!("Fresh start - no resume");
    }

    // Add the prompt
    claude_args.push("--".to_string());
    claude_args.push(prompt);

    log::debug!("Executing: claude {}", claude_args.join(" "));

    // Use Claudio's existing claude binary detection (async version to avoid runtime conflict)
    let claude_binary_path = crate::claude_binary::find_claude_binary_async(&app).await
        .map_err(|e| format!("Failed to find Claude binary: {}", e))?;
    

    // Execute claude CLI directly using the determined path
    let mut cmd = Command::new(&claude_binary_path)
        .args(&claude_args)
        .current_dir(options.working_directory.as_ref().unwrap_or(&project_path))
        .env("CLAUDIO_ID", &claudio_session_id)  // 🔥 Inject Claudio ID for hook detection
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            log::error!("Failed to spawn Claude CLI process: {}", e);
            format!("Failed to spawn Claude CLI process: {}", e)
        })?;

    // Get process ID and emit starting event
    let process_id = cmd.id();
    let (thinking_title, thinking_message) = get_thinking_content();
    
    emit_process_event(
        &app,
        &claudio_session_id,
        &temp_session_id, // Use temp ID initially
        process_id,
        ClaudeProcessStatus::Starting { action: thinking_title.clone() },
        Some(thinking_title),
        Some(thinking_message),
    ).unwrap_or_else(|e| log::warn!("Failed to emit process start event: {}", e));

    let stdout = cmd.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = cmd.stderr.take().ok_or("Failed to get stderr")?;

    // Handle stdout - parse streaming JSON
    let app_stdout = app.clone();
    let app_for_event = app.clone();  // Clone for the event emission  
    let temp_session_id_stdout = temp_session_id.clone();
    let claudio_session_id_stdout = claudio_session_id.clone();
    let resume_session_id = options.session_id.clone();
    let project_path_for_cleanup = project_path.clone();
    let project_path_for_completion = project_path.clone();
    let app_for_update = app.clone(); // Clone for the async task
    
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        let mut new_session_id: Option<String> = None;

        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break;
            }

            // Try to parse each line as streaming JSON from Claude CLI
            if let Ok(message) = serde_json::from_str::<serde_json::Value>(&line.trim()) {
                log::debug!("Claude output: {}", message.get("type").and_then(|t| t.as_str()).unwrap_or("unknown"));
                
                // Extract the new session ID from system message for session tracking
                if message.get("type") == Some(&serde_json::Value::String("system".to_string())) {
                    if let Some(claude_session_id) = message.get("session_id") {
                        if let Some(id_str) = claude_session_id.as_str() {
                            new_session_id = Some(id_str.to_string());
                            log::debug!("New Claude session ID: {}", id_str);
                            
                            // Immediately notify frontend about the new session ID
                            let session_event = serde_json::json!({
                                "type": "session_started", 
                                "session_id": id_str,        // Claude's session ID (changes each turn)
                                "claudio_id": claudio_session_id_stdout,  // Our pointer ID (constant)
                                "project_path": project_path
                            });
                            
                            if let Err(e) = app_for_event.emit_to("main", "claude_session_ready", &session_event) {
                                log::warn!("Failed to emit session ready event: {}", e);
                            }
                            
                            // Update Claudio session metadata with the new Claude session ID
                            if let Err(e) = update_session_claude_id(
                                app_for_update.clone(),
                                claudio_session_id_stdout.clone(),
                                project_path_for_cleanup.clone(),
                                id_str.to_string(),
                                resume_session_id.clone(), // This is the session we're potentially resuming from
                            ).await {
                                log::warn!("Failed to update session metadata with Claude ID: {}", e);
                            }
                        }
                    }
                }
                
                // Wrap the message for frontend compatibility
                let mut wrapped_message = serde_json::json!({
                    "type": "claude_sdk_message",
                    "session_id": temp_session_id_stdout,
                    "message": message
                });
                
                // Add the session IDs for frontend tracking
                if let Some(ref new_id) = new_session_id {
                    wrapped_message.as_object_mut().unwrap().insert(
                        "claude_session_id".to_string(),
                        serde_json::Value::String(new_id.clone())
                    );
                }
                // Always send the claudio session ID
                wrapped_message.as_object_mut().unwrap().insert(
                    "claudio_id".to_string(),
                    serde_json::Value::String(claudio_session_id_stdout.clone())
                );
                
                // Emit raw message for existing frontend compatibility
                let _ = app_stdout.emit(&format!("claude-output:{}", temp_session_id_stdout), line.trim());
            } else {
                log::warn!("Claude CLI non-JSON output: {}", line.trim());
            }

            line.clear();
        }

        // Note: Session cleanup is handled by the session watcher
        // based on last_uuid detection for reliable state-driven cleanup

    });

    // Handle stderr
    let app_stderr = app.clone();
    let temp_session_id_stderr = temp_session_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut line = String::new();

        while let Ok(bytes_read) = reader.read_line(&mut line).await {
            if bytes_read == 0 {
                break;
            }

            if !line.trim().is_empty() {
                log::error!("Claude CLI stderr: {}", line.trim());
                // Emit error to the event that SessionMessageHandler expects
                let _ = app_stderr.emit(&format!("claude-error:{}", temp_session_id_stderr), line.trim());
                let _ = app_stderr.emit(
                    &format!("claude-sdk-error:{}", temp_session_id_stderr),
                    serde_json::json!({
                        "error": line.trim()
                    })
                );
            }

            line.clear();
        }
    });

    // Wait for process completion
    let app_wait = app.clone();
    let temp_session_id_wait = temp_session_id.clone();
    let claudio_session_id_wait = claudio_session_id.clone();
    let temp_session_id_for_events = temp_session_id.clone();
    tokio::spawn(async move {
        match cmd.wait().await {
            Ok(status) => {
                if status.success() {
                    log::debug!("Claude CLI completed successfully");
                    
                    // Extract the last message UUID from the session tracked by this claudio session
                    if let Err(e) = extract_and_store_last_message_uuid_from_claudio_session(
                        claudio_session_id_wait.clone(),
                        project_path_for_completion.clone(),
                    ).await {
                        log::error!("Failed to store last message UUID: {}", e);
                    }
                    
                    // Update session status to Idle
                    if let Err(e) = update_session_status_to_idle(
                        claudio_session_id_wait.clone(), 
                        project_path_for_completion.clone()
                    ).await {
                        log::error!("Failed to update session status to Idle: {}", e);
                    }
                    
                    // Emit IDLE status for Claudio sessions (equivalent to Stop hook)
                    emit_claudio_session_status(&app_wait, &claudio_session_id_wait, &project_path_for_completion, "idle").await;
                    
                    // Emit process completion event
                    let _ = emit_process_event(
                        &app_wait,
                        &claudio_session_id_wait,
                        &temp_session_id_for_events,
                        process_id,
                        ClaudeProcessStatus::Completed,
                        None,
                        None,
                    );
                } else {
                    let reason = format!("Process exited with code {}", status.code().unwrap_or(-1));
                    log::warn!("Claude CLI failed: {}", reason);
                    // Emit process failure event
                    let _ = emit_process_event(
                        &app_wait,
                        &claudio_session_id_wait,
                        &temp_session_id_for_events,
                        process_id,
                        ClaudeProcessStatus::Failed { reason: reason.clone() },
                        Some("❌ Process failed".to_string()),
                        Some(reason),
                    );
                }
                
                // Emit completion events that SessionMessageHandler expects
                let _ = app_wait.emit(&format!("claude-complete:{}", temp_session_id_wait), status.success());
                let _ = app_wait.emit(
                    &format!("claude-sdk-completed:{}", temp_session_id_wait),
                    serde_json::json!({
                        "success": status.success(),
                        "code": status.code()
                    })
                );
            }
            Err(e) => {
                let reason = format!("Process error: {}", e);
                log::error!("Claude CLI error: {}", e);
                
                // Emit process failure event
                let _ = emit_process_event(
                    &app_wait,
                    &claudio_session_id_wait,
                    &temp_session_id_for_events,
                    process_id,
                    ClaudeProcessStatus::Failed { reason: reason.clone() },
                    Some("💥 Claude crashed".to_string()),
                    Some(format!("Process error: {}", e)),
                );
                
                // Emit errors to events that SessionMessageHandler expects
                let _ = app_wait.emit(&format!("claude-error:{}", temp_session_id_wait), e.to_string());
                let _ = app_wait.emit(&format!("claude-complete:{}", temp_session_id_wait), false);
                let _ = app_wait.emit(
                    &format!("claude-sdk-error:{}", temp_session_id_wait),
                    serde_json::json!({
                        "error": e.to_string()
                    })
                );
            }
        }
    });

    Ok(())
}

/// Helper function to update session metadata with new Claude session ID
/// Stores the old session ID temporarily for watcher-based cleanup
async fn update_session_claude_id(
    app_handle: tauri::AppHandle,
    claudio_id: String,
    project_path: String,
    new_session_id: String,
    _previous_session_id: Option<String>, // Unused - kept for API compatibility
) -> Result<(), String> {
    use crate::commands::claudio_storage::{get_claudio_session, update_claudio_session};

    // Get current metadata
    let mut session = get_claudio_session(claudio_id.clone(), project_path.clone()).await?;
    
    log::debug!("Updating claudio session {} with new Claude session ID: {}", claudio_id, new_session_id);

    // Move current_session to history (if it exists) before creating new one
    if let Some(current_session) = session.current_session.take() {
        session.session_history.insert(0, current_session); // Insert at front (newest first)
        log::debug!("Moved previous session {} to history", session.session_history[0].session_id);
    }

    // We'll extract the timestamp and UUID when the session completes
    // For now, create a placeholder that will be updated by extract_and_store_last_message_uuid_from_claudio_session
    session.current_session = Some(crate::commands::claudio_storage::SessionInfo {
        session_id: new_session_id.clone(),
        last_message_uuid: "placeholder".to_string(), // Will be updated later
        last_message_timestamp: chrono::Utc::now(), // Will be updated with actual message timestamp
    });
    
    // Save updated metadata (now updates memory immediately!)
    update_claudio_session(claudio_id.clone(), project_path.clone(), session).await?;
    log::debug!("Updated Claudio session {} to track Claude session {}", claudio_id, new_session_id);
    
    // Emit event to notify frontend that session state has changed (no delay needed!)
    // Memory is immediately consistent, so frontend will get fresh data
    #[derive(serde::Serialize)]
    struct SessionStateChangeEvent {
        claudio_id: String,
        new_claude_session_id: String,
        project_path: String,
    }
    
    let state_change_event = SessionStateChangeEvent {
        claudio_id: claudio_id.clone(),
        new_claude_session_id: new_session_id.clone(),
        project_path,
    };
    
    if let Err(e) = app_handle.emit("session-state-changed", &state_change_event) {
        log::warn!("Failed to emit session state change event: {}", e);
    } else {
        log::debug!("Emitted session state change event for Claudio session {}", claudio_id);
    }
    
    Ok(())
}

/// Extract the last message UUID from the Claude session tracked by this claudio session
/// This is called when the claude binary process completes successfully
async fn extract_and_store_last_message_uuid_from_claudio_session(
    claudio_id: String,
    project_path: String,
) -> Result<(), String> {
    use crate::commands::claude::get_claude_dir;
    use crate::commands::claudio_storage::{get_claudio_session, update_claudio_session};
    use std::process::Command;
    
    // Get the current claudio session to find out which Claude session it's tracking
    let mut claudio_session = get_claudio_session(claudio_id.clone(), project_path.clone()).await?;
    
    // Get the Claude session ID this claudio session is currently tracking
    let claude_session_id = match claudio_session.current_session.as_ref() {
        Some(session) => session.session_id.clone(),
        None => {
            log::warn!("Claudio session {} has no current session - nothing to extract UUID from", claudio_id);
            return Ok(());
        }
    };
    
    // Get the Claude session file path for the session being tracked
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_encoded = project_path.replace("/", "-");
    let session_file_path = claude_dir
        .join("projects")
        .join(project_encoded)
        .join(format!("{}.jsonl", claude_session_id));

    if !session_file_path.exists() {
        log::warn!("Claude session file does not exist: {:?}", session_file_path);
        return Ok(()); // Not an error, session might not have messages yet
    }

    // Use tail to get the last line efficiently (for large files)
    let tail_output = Command::new("tail")
        .args(&["-n", "1", session_file_path.to_str().unwrap()])
        .output()
        .map_err(|e| format!("Failed to read last line of session file: {}", e))?;
    
    if !tail_output.status.success() {
        return Err("Failed to read last line of session file".to_string());
    }
    
    let last_line = String::from_utf8_lossy(&tail_output.stdout);
    let last_line = last_line.trim();
    
    if !last_line.is_empty() {
        if let Ok(last_message) = serde_json::from_str::<serde_json::Value>(last_line) {
            if let Some(last_uuid) = last_message["uuid"].as_str() {
                // Extract timestamp from the message
                let timestamp = if let Some(created_at) = last_message["created_at"].as_str() {
                    chrono::DateTime::parse_from_rfc3339(created_at)
                        .map(|dt| dt.with_timezone(&chrono::Utc))
                        .unwrap_or_else(|_| chrono::Utc::now())
                } else {
                    chrono::Utc::now() // Fallback to current time
                };

                // Update current_session with real UUID and timestamp
                if let Some(ref mut current_session) = claudio_session.current_session {
                    current_session.last_message_uuid = last_uuid.to_string();
                    current_session.last_message_timestamp = timestamp;

                    update_claudio_session(claudio_id.clone(), project_path, claudio_session).await?;
                    log::debug!("Updated current session with UUID: {} and timestamp: {} (session: {})",
                              last_uuid, timestamp, claude_session_id);
                } else {
                    log::warn!("No current_session to update with UUID {}", last_uuid);
                }
            } else {
                log::warn!("No UUID field found in last message of session {}", claude_session_id);
            }
        } else {
            log::warn!("Failed to parse last message in session file: {}", session_file_path.display());
        }
    } else {
        log::info!("Session file {} is empty - no messages to extract UUID from", claude_session_id);
    }
    
    Ok(())
}

/// Emit Active/Idle status events for Claudio sessions (equivalent to hook scripts for native sessions)
async fn emit_claudio_session_status(
    app: &tauri::AppHandle,
    claudio_id: &str,
    project_path: &str,
    status: &str, // "active" or "idle"
) {
    use crate::commands::claude_session_tracking::ClaudeThinkingEvent;
    
    // Emit the same event format that native sessions use
    let event_data = ClaudeThinkingEvent {
        session_id: claudio_id.to_string(), // Use claudio_id as session identifier
        project_path: project_path.to_string(),
        status: status.to_string(),
        title: if status == "active" {
            // Get thinking content for active status
            let (title, _message) = get_thinking_content();
            Some(title)
        } else {
            None
        },
        message: if status == "active" {
            let (_title, message) = get_thinking_content();
            Some(message)
        } else {
            None
        },
    };
    
    // Emit the same event that native sessions emit
    if let Err(e) = app.emit("claude-session-thinking", &event_data) {
        log::error!("Failed to emit Claudio session status event: {}", e);
    } else {
        log::debug!("Emitted Claudio session status: {} -> {}", claudio_id, status);
    }
}

/// Update Claudio session status to Idle when Claude CLI execution completes
async fn update_session_status_to_idle(
    claudio_id: String,
    project_path: String,
) -> Result<(), String> {
    use crate::commands::claudio_storage::{get_claudio_session, update_claudio_session};
    
    // Get current session
    let mut session = get_claudio_session(claudio_id.clone(), project_path.clone()).await?;
    
    // Update status to Idle
    session.status = SessionStatus::Idle;
    
    // Save updated session
    update_claudio_session(claudio_id.clone(), project_path, session).await?;
    log::debug!("Updated Claudio session {} status to Idle", claudio_id);
    
    Ok(())
}