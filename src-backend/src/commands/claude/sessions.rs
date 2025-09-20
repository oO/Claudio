use super::types::*;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::time::{SystemTime, Duration, UNIX_EPOCH};
use tauri::command;
use serde::{Deserialize, Serialize};
use crate::commands::claudio_storage::get_claudio_session;
use crate::commands::session_orchestrator::{SESSION_TYPE_CLAUDIO, SESSION_TYPE_NATIVE};
use crate::paths::{claudio_home_dir, CLAUDE_PROJECTS_DIR, SESSION_FILE_EXTENSION, JSON_EXTENSION};

/// Fast line counting without JSON parsing
fn count_lines_fast(file_path: &PathBuf) -> Result<u64, std::io::Error> {
    use std::io::{BufRead, BufReader};
    let file = fs::File::open(file_path)?;
    let reader = BufReader::new(file);
    Ok(reader.lines().count() as u64)
}

/// Gets sessions for a specific project with Claudio metadata decoration
#[command]
pub async fn get_project_sessions(project_id: String) -> Result<Vec<DecoratedSession>, String> {
    let start_time = std::time::Instant::now();

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);

    if !project_dir.exists() {
        return Err(format!("Project directory not found: {}", project_id));
    }

    // Get the actual project path from JSONL files
    let project_path = match get_project_path_from_sessions(&project_dir) {
        Ok(path) => path,
        Err(e) => {
            log::warn!(
                "Failed to get project path from sessions for {}: {}, falling back to decode",
                project_id,
                e
            );
            decode_project_path(&project_id)
        }
    };

    let mut sessions: Vec<DecoratedSession> = Vec::new();

    // Read all JSONL files in the project directory
    let entries = fs::read_dir(&project_dir)
        .map_err(|e| format!("Failed to read project directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some(SESSION_FILE_EXTENSION) {
            if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                // Get file creation time
                let metadata = fs::metadata(&path)
                    .map_err(|e| format!("Failed to read file metadata: {}", e))?;

                let created_at = metadata
                    .created()
                    .or_else(|_| metadata.modified())
                    .unwrap_or(SystemTime::UNIX_EPOCH)
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                let modified_at = metadata
                    .modified()
                    .or_else(|_| metadata.created())
                    .unwrap_or(SystemTime::UNIX_EPOCH)
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();

                // Extract first user message (lightweight - bails out early)
                let (first_message, _) = extract_first_user_message(&path);

                // Get file size from metadata (no file parsing)
                let file_size = metadata.len();

                // Fast line count for message count (no JSON parsing)
                let message_count = count_lines_fast(&path).unwrap_or(0);

                // Check for Claudio metadata by looking for a claudio session that references this Claude session
                let claudio_metadata = find_claudio_metadata_for_session(&session_id, &project_path).await;

                // Check for native Claude session file
                let claudio_dir = claudio_home_dir()?;
                let native_file = claudio_dir.join(CLAUDE_PROJECTS_DIR).join(&project_id).join(format!("claude-{}.json", session_id));
                
                // Determine session ID and type based on Claudio metadata
                let (actual_session_id, live_session_type) = if let Some(ref claudio_session) = claudio_metadata {
                    // For Claudio sessions, use the claudio_id as the session ID
                    (claudio_session.claudio_id.clone(), Some(SESSION_TYPE_CLAUDIO.to_string()))
                } else if native_file.exists() {
                    // For native sessions, use the native session_id
                    (session_id.to_string(), Some(SESSION_TYPE_NATIVE.to_string()))
                } else {
                    // Unknown session type
                    (session_id.to_string(), None)
                };

                // Aggregate todo counts from agent executions
                let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
                let todo_counts = aggregate_session_todos(&claude_dir, &session_id);

                sessions.push(DecoratedSession {
                    id: actual_session_id,
                    project_id: project_id.clone(),
                    project_path: project_path.clone(),
                    created_at,
                    modified_at,
                    first_message,
                    size_bytes: Some(file_size),
                    message_count: if message_count > 0 { Some(message_count) } else { None },
                    live_session_type,
                    todo_counts,
                });
            }
        }
    }

    // Sort sessions by modification time (newest first)
    sessions.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    let duration = start_time.elapsed();
    log::debug!("Found {} sessions for project {} in {:.2}ms", sessions.len(), project_id, duration.as_secs_f64() * 1000.0);
    Ok(sessions)
}

/// Gets all todo files for a specific session
#[command]
pub async fn get_session_todos(session_id: String) -> Result<serde_json::Value, String> {
    // log::info!("🔍 Getting todos for session: {}", session_id);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let todos_dir = claude_dir.join("todos");
    let pattern = format!("{}-agent-", session_id);
    
    
    let mut agent_todos = Vec::new();
    let mut total_counts = super::types::TodoCounts { open: 0, completed: 0, total: 0 };
    
    // Find all agent todo files for this session
    if todos_dir.exists() {
        if let Ok(entries) = fs::read_dir(&todos_dir) {
            let mut found_files = Vec::new();
            let mut matching_files = Vec::new();
            
            for entry in entries.flatten() {
                let file_name = entry.file_name().to_string_lossy().to_string();
                found_files.push(file_name.clone());
                
                // Check if this is an agent todo file for our session
                if file_name.starts_with(&pattern) && file_name.ends_with(&format!(".{}", JSON_EXTENSION)) {
                    matching_files.push(file_name.clone());
                    
                    // Extract agent ID from filename: {session_id}-agent-{agent_id}.json
                    let agent_id = file_name
                        .strip_prefix(&pattern)
                        .and_then(|s| s.strip_suffix(&format!(".{}", JSON_EXTENSION)))
                        .unwrap_or("unknown")
                        .to_string();
                    
                    
                    match super::types::parse_agent_todo_file(&entry.path()) {
                        Ok(todos) => {
                            let counts = super::types::count_todos_by_status(&todos);
                            
                            // Add to totals
                            total_counts.open += counts.open;
                            total_counts.completed += counts.completed;
                            total_counts.total += counts.total;
                            
                            agent_todos.push(serde_json::json!({
                                "agent_id": agent_id,
                                "file_path": entry.path().to_string_lossy(),
                                "todos": todos,
                                "counts": counts,
                            }));
                        }
                        Err(e) => {
                            log::warn!("❌ Failed to parse todo file {}: {}", file_name, e);
                        }
                    }
                }
            }
            
        } else {
            log::warn!("Failed to read todos directory: {:?}", todos_dir);
        }
    } else {
        log::warn!("Todos directory does not exist: {:?}", todos_dir);
    }
    
    let result = serde_json::json!({
        "session_id": session_id,
        "agent_todos": agent_todos,
        "total_counts": total_counts,
        "agent_count": agent_todos.len(),
    });
    
    // log::info!("📝 Returning todo data for session {}: agent_count={}, total_open={}, total_completed={}, total_todos={}", 
    //            session_id, agent_todos.len(), total_counts.open, total_counts.completed, total_counts.total);
    
    Ok(result)
}

/// Helper function to get project path from Claudio session file 
/// This is more reliable than parsing Claude's JSONL files
async fn get_project_path_from_claudio_session(session_id: &str, project_id: &str) -> Result<String, String> {
    // Try to find a Claudio session that tracks this Claude session
    let claudio_projects_dir = claudio_home_dir()?.join(CLAUDE_PROJECTS_DIR)
        .join(project_id);

    if claudio_projects_dir.exists() {
        // Look for Claudio session files in this project directory
        if let Ok(entries) = fs::read_dir(&claudio_projects_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some(JSON_EXTENSION) {
                        // Try to load the Claudio session by its claudio_id
                        if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                            // Decode project_id to get project_path for get_claudio_session call
                            let fallback_project_path = decode_project_path(project_id);
                            if let Ok(claudio_session) = get_claudio_session(file_stem.to_string(), fallback_project_path).await {
                                // Check if this Claudio session tracks the Claude session we're looking for
                                if let Some(ref current_session) = claudio_session.current_session {
                                    if current_session.session_id == session_id {
                                        log::debug!("Found project path from Claudio session: {}", claudio_session.project_path);
                                        return Ok(claudio_session.project_path);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Err("No matching Claudio session found".to_string())
}

/// Helper function to build session metadata for a single session file
async fn build_session_metadata(session_path: &std::path::Path, session_id: &str, project_id: &str) -> Result<Session, String> {
    let metadata = fs::metadata(session_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    let created_at = metadata
        .created()
        .or_else(|_| metadata.modified())
        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let modified_at = metadata
        .modified()
        .or_else(|_| metadata.created())
        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let file_size = metadata.len();

    // Get project path from Claudio session file instead of parsing Claude's JSONL files
    let project_path = match get_project_path_from_claudio_session(&session_id, &project_id).await {
        Ok(path) => path,
        Err(e) => {
            log::warn!("Failed to get project path from Claudio session for {}: {}, falling back to decode", session_id, e);
            decode_project_path(project_id)
        }
    };

    // Extract first user message and timestamp
    let session_path_buf = session_path.to_path_buf();
    let (first_message, message_timestamp) = extract_first_user_message(&session_path_buf);

    // Parse session analytics
    let analytics = parse_session_analytics(&session_path_buf);

    // Aggregate todo counts from agent executions
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let todo_counts = aggregate_session_todos(&claude_dir, session_id);

    Ok(Session {
        id: session_id.to_string(),
        project_id: project_id.to_string(),
        project_path,
        todo_data: None, // Removed: unused single-file pattern, only agent todos exist
        todo_counts,
        created_at,
        modified_at,
        first_message,
        message_timestamp,
        size_bytes: Some(file_size),
        token_count: if analytics.token_count > 0 { Some(analytics.token_count) } else { None },
        cost_usd: if analytics.cost_usd > 0.0 { Some(analytics.cost_usd) } else { None },
        message_count: if analytics.message_count > 0 { Some(analytics.message_count) } else { None },
    })
}

/// Loads the JSONL history for a specific session
#[command]
pub async fn load_session_history(
    session_id: String,
    project_id: String,
) -> Result<SessionWithContent, String> {
    log::info!(
        "Loading session history for session: {} in project: {}",
        session_id,
        project_id
    );

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let session_path = claude_dir
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", session_id));

    if !session_path.exists() {
        return Err(format!("Session file not found: {}", session_id));
    }

    // Get session metadata
    let session_metadata = build_session_metadata(&session_path, &session_id, &project_id).await?;

    // Load and parse JSONL content
    let file = fs::File::open(&session_path)
        .map_err(|e| format!("Failed to open session file: {}", e))?;
    
    let reader = BufReader::new(file);
    let mut messages = Vec::new();

    for line in reader.lines() {
        if let Ok(line) = line {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                messages.push(json);
            }
        }
    }

    Ok(SessionWithContent {
        session: session_metadata,
        file_path: session_path.to_string_lossy().to_string(),
        content: messages,
    })
}


/// Deletes a specific Claude session from a project and all associated data
/// Note: This function only handles Claude session IDs (UUID format), not Claudio session IDs
#[command]
pub async fn delete_session(project_id: String, session_id: String) -> Result<serde_json::Value, String> {
    log::info!("Deleting Claude session '{}' from project '{}'", session_id, project_id);

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);

    // This function only handles Claude session IDs (UUID format)
    // For Claudio session management, use dedicated claudio_storage functions
    let actual_session_id = session_id.clone();
    
    let session_file = project_dir.join(format!("{}.jsonl", actual_session_id));
    
    if !session_file.exists() {
        return Err(format!("Session '{}' not found in project '{}'", actual_session_id, project_id));
    }
    
    // Get file size before deletion
    let file_size = fs::metadata(&session_file)
        .map_err(|e| format!("Failed to get session file metadata: {}", e))?
        .len();
    
    // Decode project path for unified cleanup
    let decoded_project_path = crate::commands::claude::decode_project_path(&project_id);
    
    // Use unified DRY cleanup function (this handles both Claude and Claudio files)
    let (_claude_files_deleted, mut claudio_files_deleted) = crate::commands::claudio_storage::cleanup_session_files(&decoded_project_path, &actual_session_id).await
        .unwrap_or((0, 0));

    // Check if this Claude session is the current_session of any Claudio session
    // If so, delete the Claudio session file as well
    match crate::commands::claudio_storage::find_claudio_session_by_current_session(&decoded_project_path, &actual_session_id).await {
        Ok(Some(claudio_session)) => {
            log::info!("Claude session '{}' is current session of Claudio session '{}', deleting Claudio session", actual_session_id, claudio_session.claudio_id);
            match crate::commands::claudio_storage::delete_claudio_session(claudio_session.claudio_id, decoded_project_path.clone()).await {
                Ok(_) => {
                    claudio_files_deleted += 1;
                    log::info!("Successfully deleted Claudio session");
                },
                Err(e) => {
                    log::warn!("Failed to delete Claudio session: {}", e);
                }
            }
        },
        Ok(None) => {
            // No Claudio session has this as current_session, normal cleanup
        },
        Err(e) => {
            log::warn!("Error checking for Claudio sessions: {}", e);
        }
    }
    
    // Clean up associated todos and timelines (not covered by cleanup_session_files)
    let (todos_deleted, timelines_deleted) = super::projects::delete_session_dependencies(&claude_dir, &project_dir, &actual_session_id);
    
    // Note: Statsig files don't appear to be session-specific based on file structure analysis
    // They seem to be global cache files, so we don't delete them
    
    log::info!("Successfully deleted session '{}' with {} claudio sessions, {} todos, {} timelines ({:.2} KB)", 
               session_id, claudio_files_deleted, todos_deleted, timelines_deleted, file_size as f64 / 1024.0);
    
    Ok(serde_json::json!({
        "success": true,
        "session_id": session_id,
        "project_id": project_id,
        "claudio_sessions_deleted": claudio_files_deleted,
        "todos_deleted": todos_deleted,
        "timelines_deleted": timelines_deleted,
        "size_kb": file_size as f64 / 1024.0,
        "message": format!("Deleted session {} with {} claudio sessions, {} todos, {} timelines", 
                          session_id, claudio_files_deleted, todos_deleted, timelines_deleted)
    }))
}

/// Prunes old sessions based on age and minimum count to keep
#[command]
pub async fn prune_old_sessions(
    project_id: Option<String>,
    days_old: u32,
    keep_min: usize,
) -> Result<serde_json::Value, String> {
    log::info!("Pruning sessions older than {} days, keeping at least {} sessions", days_old, keep_min);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let projects_dir = claude_dir.join("projects");
    
    let mut total_deleted = 0;
    let mut total_size_freed = 0u64;
    let mut projects_processed = Vec::new();
    
    let cutoff_time = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs() - (days_old as u64 * 24 * 60 * 60);
    
    // Determine which projects to process
    let projects_to_process = if let Some(specific_project) = project_id {
        vec![specific_project]
    } else {
        // Get all project IDs
        fs::read_dir(&projects_dir)
            .map_err(|e| format!("Failed to read projects directory: {}", e))?
            .filter_map(|entry| {
                entry.ok()
                    .filter(|e| e.path().is_dir())
                    .and_then(|e| e.file_name().to_str().map(|s| s.to_string()))
            })
            .collect()
    };
    
    for project_id in projects_to_process {
        let project_dir = projects_dir.join(&project_id);
        if !project_dir.exists() {
            continue;
        }
        
        // Get all session files with metadata
        let mut sessions = Vec::new();
        let entries = fs::read_dir(&project_dir)
            .map_err(|e| format!("Failed to read project directory: {}", e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some(SESSION_FILE_EXTENSION) {
                if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                    let metadata = fs::metadata(&path)
                        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
                    
                    let modified_time = metadata
                        .modified()
                        .or_else(|_| metadata.created())
                        .unwrap_or(SystemTime::UNIX_EPOCH)
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();
                    
                    sessions.push((session_id.to_string(), path, modified_time, metadata.len()));
                }
            }
        }
        
        // Sort by modification time (newest first)
        sessions.sort_by(|a, b| b.2.cmp(&a.2));
        
        // Keep at least keep_min sessions, delete the rest if they're old enough
        let mut deleted_count = 0;
        let mut freed_size = 0u64;
        
        for (i, (session_id, path, modified_time, size)) in sessions.iter().enumerate() {
            // Skip if we need to keep minimum sessions
            if i < keep_min {
                continue;
            }
            
            // Delete if old enough
            if *modified_time < cutoff_time {
                fs::remove_file(path)
                    .map_err(|e| format!("Failed to delete session file: {}", e))?;
                
                // Also try to delete associated todo file
                let todo_file = claude_dir.join("todos").join(format!("{}.json", session_id));
                if todo_file.exists() {
                    let _ = fs::remove_file(&todo_file);
                }
                
                deleted_count += 1;
                freed_size += size;
                log::info!("Deleted old session '{}' from project '{}'", session_id, project_id);
            }
        }
        
        if deleted_count > 0 {
            projects_processed.push(serde_json::json!({
                "project_id": project_id,
                "sessions_deleted": deleted_count,
                "size_freed_mb": freed_size as f64 / 1024.0 / 1024.0
            }));
            
            total_deleted += deleted_count;
            total_size_freed += freed_size;
        }
    }
    
    log::info!("Pruning complete: deleted {} sessions, freed {:.2} MB", 
               total_deleted, total_size_freed as f64 / 1024.0 / 1024.0);
    
    Ok(serde_json::json!({
        "success": true,
        "total_sessions_deleted": total_deleted,
        "total_size_freed_mb": total_size_freed as f64 / 1024.0 / 1024.0,
        "projects_processed": projects_processed,
        "message": format!("Deleted {} old sessions", total_deleted)
    }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionDeletionPreview {
    pub sessions_to_delete: Vec<DecoratedSession>,
    pub sessions_to_keep: Vec<DecoratedSession>,
    pub total_sessions: usize,
    pub sessions_to_delete_count: usize,
    pub sessions_to_keep_count: usize,
    pub size_to_free_mb: f64,
}

/// Gets a preview of sessions that would be deleted based on age threshold
#[command]
pub async fn preview_session_deletion_by_age(
    project_id: String,
    days_old: u64
) -> Result<SessionDeletionPreview, String> {
    log::info!("Previewing session deletion for project '{}' older than {} days", project_id, days_old);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    
    if !project_dir.exists() {
        return Err(format!("Project '{}' not found", project_id));
    }
    
    // Get all sessions for the project
    let all_sessions = get_project_sessions(project_id.clone()).await?;
    
    // Calculate the cutoff timestamp
    let cutoff_duration = Duration::from_secs(days_old * 24 * 60 * 60);
    let cutoff_timestamp = SystemTime::now()
        .checked_sub(cutoff_duration)
        .ok_or("Invalid duration")?;
    
    let mut sessions_to_delete: Vec<DecoratedSession> = Vec::new();
    let mut sessions_to_keep: Vec<DecoratedSession> = Vec::new();
    let mut size_to_free = 0u64;
    
    for session in all_sessions {
        // Get the actual file modification time
        let session_file = project_dir.join(format!("{}.jsonl", session.id));
        if let Ok(metadata) = session_file.metadata() {
            if let Ok(modified_time) = metadata.modified() {
                if modified_time < cutoff_timestamp {
                    size_to_free += session.size_bytes.unwrap_or(0);
                    sessions_to_delete.push(session);
                } else {
                    sessions_to_keep.push(session);
                }
            } else {
                // If we can't get modified time, use created_at as fallback
                let created_time = UNIX_EPOCH + Duration::from_secs(session.created_at);
                if created_time < cutoff_timestamp {
                    size_to_free += session.size_bytes.unwrap_or(0);
                    sessions_to_delete.push(session);
                } else {
                    sessions_to_keep.push(session);
                }
            }
        }
    }
    
    // Sort sessions by created_at (oldest first for deletion, newest first for keeping)
    sessions_to_delete.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    sessions_to_keep.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    Ok(SessionDeletionPreview {
        total_sessions: sessions_to_delete.len() + sessions_to_keep.len(),
        sessions_to_delete_count: sessions_to_delete.len(),
        sessions_to_keep_count: sessions_to_keep.len(),
        sessions_to_delete,
        sessions_to_keep,
        size_to_free_mb: size_to_free as f64 / 1024.0 / 1024.0,
    })
}

/// Deletes sessions older than specified days for a project
#[command]
pub async fn delete_sessions_by_age(
    project_id: String,
    days_old: u64
) -> Result<serde_json::Value, String> {
    log::info!("Deleting sessions for project '{}' older than {} days", project_id, days_old);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    
    if !project_dir.exists() {
        return Err(format!("Project '{}' not found", project_id));
    }
    
    // Get preview to know what will be deleted
    let preview = preview_session_deletion_by_age(project_id.clone(), days_old).await?;
    
    let mut sessions_deleted = 0;
    let mut claudio_sessions_deleted = 0;
    let mut todos_deleted = 0;
    let mut timelines_deleted = 0;
    
    // Decode project path for unified cleanup
    let decoded_project_path = crate::commands::claude::decode_project_path(&project_id);
    
    // Delete each session and its dependencies
    for session in &preview.sessions_to_delete {
        // Use unified DRY cleanup function (handles both Claude and Claudio files)
        let (claude_files, claudio_files) = crate::commands::claudio_storage::cleanup_session_files(&decoded_project_path, &session.id).await
            .unwrap_or((0, 0));
        
        if claude_files > 0 {
            sessions_deleted += claude_files;
        }
        claudio_sessions_deleted += claudio_files;
        
        // Clean up todos and timelines (not covered by cleanup_session_files)
        let (session_todos, session_timelines) = super::projects::delete_session_dependencies(
            &claude_dir, &project_dir, &session.id
        );
        todos_deleted += session_todos;
        timelines_deleted += session_timelines;
    }
    
    log::info!(
        "Successfully deleted {} sessions, {} claudio sessions, {} todos, {} timelines for project '{}' ({:.2} MB freed)",
        sessions_deleted, claudio_sessions_deleted, todos_deleted, timelines_deleted, project_id, preview.size_to_free_mb
    );
    
    Ok(serde_json::json!({
        "success": true,
        "project_id": project_id,
        "sessions_deleted": sessions_deleted,
        "claudio_sessions_deleted": claudio_sessions_deleted,
        "todos_deleted": todos_deleted,
        "timelines_deleted": timelines_deleted,
        "sessions_remaining": preview.sessions_to_keep_count,
        "size_freed_mb": preview.size_to_free_mb,
        "days_old": days_old,
        "message": format!(
            "Deleted {} sessions, {} claudio sessions older than {} days ({} remaining)", 
            sessions_deleted, claudio_sessions_deleted, days_old, preview.sessions_to_keep_count
        )
    }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionAgeRange {
    pub newest_age_days: u64,
    pub oldest_age_days: u64,
    pub total_sessions: usize,
    pub has_sessions: bool,
}

/// Gets the age range of sessions in a project (newest to oldest in days)
#[command]
pub async fn get_session_age_range(project_id: String) -> Result<SessionAgeRange, String> {
    log::info!("Getting session age range for project '{}'", project_id);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    
    if !project_dir.exists() {
        return Err(format!("Project '{}' not found", project_id));
    }
    
    // Get all sessions for the project
    let all_sessions = get_project_sessions(project_id.clone()).await?;
    
    if all_sessions.is_empty() {
        return Ok(SessionAgeRange {
            newest_age_days: 0,
            oldest_age_days: 0,
            total_sessions: 0,
            has_sessions: false,
        });
    }
    
    let now = SystemTime::now();
    let mut newest_time: Option<SystemTime> = None;
    let mut oldest_time: Option<SystemTime> = None;
    
    for session in &all_sessions {
        // Get the actual file modification time
        let session_file = project_dir.join(format!("{}.jsonl", session.id));
        let session_time = if let Ok(metadata) = session_file.metadata() {
            if let Ok(modified_time) = metadata.modified() {
                modified_time
            } else {
                // If we can't get modified time, use created_at as fallback
                UNIX_EPOCH + Duration::from_secs(session.created_at)
            }
        } else {
            // If file doesn't exist, use created_at as fallback
            UNIX_EPOCH + Duration::from_secs(session.created_at)
        };
        
        match (newest_time, oldest_time) {
            (None, None) => {
                newest_time = Some(session_time);
                oldest_time = Some(session_time);
            },
            (Some(newest), Some(oldest)) => {
                if session_time > newest {
                    newest_time = Some(session_time);
                }
                if session_time < oldest {
                    oldest_time = Some(session_time);
                }
            },
            _ => unreachable!(),
        }
    }
    
    let newest_age_days = if let Some(newest) = newest_time {
        now.duration_since(newest)
            .unwrap_or(Duration::from_secs(0))
            .as_secs() / (24 * 60 * 60)
    } else {
        0
    };
    
    let oldest_age_days = if let Some(oldest) = oldest_time {
        now.duration_since(oldest)
            .unwrap_or(Duration::from_secs(0))
            .as_secs() / (24 * 60 * 60)
    } else {
        0
    };
    
    Ok(SessionAgeRange {
        newest_age_days,
        oldest_age_days: oldest_age_days.max(1), // Ensure at least 1 day minimum
        total_sessions: all_sessions.len(),
        has_sessions: true,
    })
}

/// Find Claudio metadata for a given Claude session ID
/// Searches through all Claudio sessions to find one that references the given Claude session
async fn find_claudio_metadata_for_session(
    claude_session_id: &str, 
    project_path: &str
) -> Option<crate::commands::claudio_storage::ClaudioSession> {
    use crate::commands::claudio_storage::{get_project_claudio_dir, get_claudio_session};

    // Get the claudio directory for this project
    let claudio_project_dir = match get_project_claudio_dir(project_path) {
        Ok(dir) => dir,
        Err(e) => {
            log::debug!("Failed to get claudio project dir for {}: {}", project_path, e);
            return None;
        }
    };

    if !claudio_project_dir.exists() {
        return None;
    }

    // Look through all claudio session files in this project
    if let Ok(entries) = std::fs::read_dir(&claudio_project_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Some(claudio_id) = path.file_stem().and_then(|s| s.to_str()) {
                        // Try to load this claudio session
                        if let Ok(claudio_session) = get_claudio_session(
                            claudio_id.to_string(), 
                            project_path.to_string()
                        ).await {
                            // Check if this claudio session references our Claude session
                            if let Some(ref current_session) = claudio_session.current_session {
                                if current_session.session_id == claude_session_id {
                                    log::debug!("Found claudio metadata for session {}: claudio_id={}", claude_session_id, claudio_id);
                                    return Some(claudio_session);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    None
}