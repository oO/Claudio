use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tauri::{command, AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use crate::commands::claudio_storage::{
    update_claudio_session, ClaudeSettings, SessionStatus, ClaudioSession
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
fn get_thinking_content() -> (String, String) {
    let title = get_random_thinking_title();
    let message = get_random_thinking_message();
    (title, message)
}

/// Get a random thinking title from resource file
fn get_random_thinking_title() -> String {
    if let Ok(titles) = load_thinking_titles_from_file() {
        if !titles.is_empty() {
            use rand::seq::SliceRandom;
            return titles.choose(&mut rand::thread_rng())
                .cloned()
                .unwrap_or_else(|| "Claude is thinking...".to_string());
        }
    }
    
    // Fallback titles if file loading fails
    let fallback_titles = [
        "Claude is willy-nillying...",
        "Claude is discombobulating...", 
        "Claude is pondering...",
        "Claude is thinking...",
    ];
    
    use rand::seq::SliceRandom;
    fallback_titles.choose(&mut rand::thread_rng())
        .unwrap_or(&"Claude is thinking...")
        .to_string()
}

/// Get a random thinking message (haiku) from resource file
fn get_random_thinking_message() -> String {
    if let Ok(messages) = load_thinking_messages_from_file() {
        if !messages.is_empty() {
            use rand::seq::SliceRandom;
            return messages.choose(&mut rand::thread_rng())
                .cloned()
                .unwrap_or_else(|| "Data streams run dry — Silent voices in the void — Fallback haiku saves".to_string());
        }
    }
    
    // Fallback messages if file loading fails
    let fallback_messages = [
        "Code flows like water — Through circuits of thought and dream — Beauty takes its form",
        "Algorithms dance — In silicon valleys deep — Logic finds its way",
        "Data streams run dry — Silent voices in the void — Fallback haiku saves",
    ];
    
    use rand::seq::SliceRandom;
    fallback_messages.choose(&mut rand::thread_rng())
        .unwrap_or(&"Data streams run dry — Silent voices in the void — Fallback haiku saves")
        .to_string()
}

/// Load thinking titles from the resource file
fn load_thinking_titles_from_file() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let resource_path = std::path::Path::new("src-backend/resources/claude_thinking_titles.txt");
    let content = std::fs::read_to_string(resource_path)?;
    
    let titles: Vec<String> = content
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();
        
    Ok(titles)
}

/// Load thinking messages (haikus) from the resource file
fn load_thinking_messages_from_file() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let resource_path = std::path::Path::new("src-backend/resources/claude_thinking_messages.txt");
    let content = std::fs::read_to_string(resource_path)?;
    
    let messages: Vec<String> = content
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();
        
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
    
    log::info!("🚀 Process event emitted: {:?}", event);
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
    log::debug!("Starting Claude CLI direct session at {}", project_path);
    log::info!("📋 DIRECT SESSION DEBUG:");
    log::info!("   claudio_id: {:?}", options.claudio_id);
    log::info!("   session_id: {:?}", options.session_id);
    log::info!("   working_directory: {:?}", options.working_directory);
    log::info!("   prompt: {}", prompt.chars().take(50).collect::<String>());
    
    let session_id = options.session_id.as_ref();
    let claudio_id = options.claudio_id.as_ref();
    

    // Simple 2-case logic based on what IDs we have
    log::info!("🔍 SESSION MATCHING: claudio_id={:?}, session_id={:?}", claudio_id, session_id);
    let (claudio_session_id, use_resume) = match (claudio_id, session_id) {
        (None, None) => {
            // Case 1: Fresh start - create new Claudio session
            log::debug!("Case 1: Fresh start");
            let new_claudio_id = format!("claudio-{}", chrono::Utc::now().timestamp_millis());
            
            let claude_settings = ClaudeSettings {
                model: None,
                max_turns: options.max_turns,
                system_prompt: options.custom_system_prompt.clone(),
                append_system_prompt: None,
                tools: options.allowed_tools.clone(),
                working_directory: options.working_directory.clone(),
            };
            
            let new_session = ClaudioSession {
                claudio_id: new_claudio_id.clone(),
                session_id: None,
                project_path: project_path.clone(),
                status: SessionStatus::Active,
                settings: claude_settings,
                last_message_uuid: None,
            };
            
            update_claudio_session(new_claudio_id.clone(), project_path.clone(), new_session).await
                .map_err(|e| format!("Failed to create Claudio session: {}", e))?;
                
            (new_claudio_id, false) // No --resume
        },
        
        (None, Some(session_id)) => {
            // Bonus Case: Fork existing Claude session - create new Claudio session but use --resume
            log::debug!("Bonus Case: Forking session {}", session_id);
            let new_claudio_id = format!("claudio-{}", chrono::Utc::now().timestamp_millis());
            
            let claude_settings = ClaudeSettings {
                model: None,
                max_turns: options.max_turns,
                system_prompt: options.custom_system_prompt.clone(),
                append_system_prompt: None,
                tools: options.allowed_tools.clone(),
                working_directory: options.working_directory.clone(),
            };
            
            let new_session = ClaudioSession {
                claudio_id: new_claudio_id.clone(),
                session_id: None,  // Don't pre-populate - let update_session_claude_id handle it
                project_path: project_path.clone(),
                status: SessionStatus::Active,
                settings: claude_settings,
                last_message_uuid: None,
            };
            
            update_claudio_session(new_claudio_id.clone(), project_path.clone(), new_session).await
                .map_err(|e| format!("Failed to create Claudio session: {}", e))?;
                
            (new_claudio_id, true) // Use --resume
        },
        
        (Some(claudio_id), Some(_session_id)) => {
            // Case 2: Continue conversation - update existing Claudio session
            log::debug!("Case 2: Continue conversation");
            (claudio_id.clone(), true) // Use --resume
        },
        
        (Some(claudio_id), None) => {
            // Case 1: Fresh start with existing Claudio session
            log::info!("✨ CASE 1: Fresh start with existing Claudio session");
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

    // Use Claudio's existing claude binary detection
    let claude_binary_path = crate::claude_binary::find_claude_binary(&app)
        .map_err(|e| format!("Failed to find Claude binary: {}", e))?;
    

    // Execute claude CLI directly using the determined path
    let mut cmd = Command::new(&claude_binary_path)
        .args(&claude_args)
        .current_dir(options.working_directory.as_ref().unwrap_or(&project_path))
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
    let current_session_id = options.session_id.clone();
    let project_path_for_cleanup = project_path.clone();
    
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
                                claudio_session_id_stdout.clone(),
                                project_path_for_cleanup.clone(),
                                id_str.to_string(),
                                current_session_id.clone(),
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

        // Note: Session cleanup is now handled in update_session_claude_id function
        // based on ownership tracking in Claudio metadata

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
async fn update_session_claude_id(
    claudio_id: String,
    project_path: String,
    new_session_id: String,
    _unused_parameter: Option<String>, // Keep for function signature compatibility
) -> Result<(), String> {
    use crate::commands::claudio_storage::{get_claudio_session, update_claudio_session};

    // Get current metadata
    let mut session = get_claudio_session(claudio_id.clone(), project_path.clone()).await?;
    
    // Clean up previous Claude session if WE HAVE ONE TRACKED (ownership check)
    if let Some(prev_session_id) = &session.session_id {
        if prev_session_id != &new_session_id {
            log::debug!("Cleaning up previous session: {}", prev_session_id);
            cleanup_claude_session(&project_path, prev_session_id).await;
        }
    } else {
        log::debug!("No previous session to cleanup");
    }
    
    // Update with new Claude session info
    session.session_id = Some(new_session_id.clone());
    
    // Save updated metadata
    update_claudio_session(claudio_id.clone(), project_path, session).await?;
    log::debug!("Updated Claudio session with new session_id");
    
    Ok(())
}

/// Clean up previous Claude CLI session file
async fn cleanup_claude_session(project_path: &str, claude_session_id: &str) {
    // Delete Claude CLI session file
    let claude_project_path = project_path.replace("/", "-");
    let claude_session_file = format!(
        "/Users/olivier/.claude/projects/{}/{}.jsonl",
        claude_project_path, claude_session_id
    );
    
    if let Err(e) = tokio::fs::remove_file(&claude_session_file).await {
        log::warn!("Failed to cleanup Claude session {}: {}", claude_session_id, e);
    } else {
        log::info!("🗑️ Cleaned up previous Claude session: {}", claude_session_file);
    }
}