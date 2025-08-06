use super::types::*;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::time::SystemTime;
use tauri::command;

/// Gets sessions for a specific project
#[command]
pub async fn get_project_sessions(project_id: String) -> Result<Vec<Session>, String> {
    log::info!("Getting sessions for project: {}", project_id);

    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    let todos_dir = claude_dir.join("todos");

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

    let mut sessions = Vec::new();

    // Read all JSONL files in the project directory
    let entries = fs::read_dir(&project_dir)
        .map_err(|e| format!("Failed to read project directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
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

                // Extract first user message and timestamp
                let (first_message, message_timestamp) = extract_first_user_message(&path);

                // Try to load associated todo data
                let todo_path = todos_dir.join(format!("{}.json", session_id));
                let todo_data = if todo_path.exists() {
                    fs::read_to_string(&todo_path)
                        .ok()
                        .and_then(|content| serde_json::from_str(&content).ok())
                } else {
                    None
                };

                // Parse session analytics
                let analytics = parse_session_analytics(&path);
                let file_size = metadata.len();

                // Aggregate todo counts from agent executions
                let todo_counts = aggregate_session_todos(&claude_dir, &session_id);

                sessions.push(Session {
                    id: session_id.to_string(),
                    project_id: project_id.clone(),
                    project_path: project_path.clone(),
                    todo_data,
                    todo_counts,
                    created_at,
                    first_message,
                    message_timestamp,
                    size_bytes: Some(file_size),
                    token_count: if analytics.token_count > 0 { Some(analytics.token_count) } else { None },
                    cost_usd: if analytics.cost_usd > 0.0 { Some(analytics.cost_usd) } else { None },
                    message_count: if analytics.message_count > 0 { Some(analytics.message_count) } else { None },
                });
            }
        }
    }

    // Sort sessions by creation time (newest first)
    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    log::info!(
        "Found {} sessions for project {}",
        sessions.len(),
        project_id
    );
    Ok(sessions)
}

/// Loads the JSONL history for a specific session
#[command]
pub async fn load_session_history(
    session_id: String,
    project_id: String,
) -> Result<Vec<serde_json::Value>, String> {
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

    let file =
        fs::File::open(&session_path).map_err(|e| format!("Failed to open session file: {}", e))?;

    let reader = BufReader::new(file);
    let mut messages = Vec::new();

    for line in reader.lines() {
        if let Ok(line) = line {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                messages.push(json);
            }
        }
    }

    Ok(messages)
}

/// Track session messages from the frontend for checkpointing
#[command]
pub async fn track_session_messages(
    state: tauri::State<'_, crate::checkpoint::state::CheckpointState>,
    session_id: String,
    project_id: String,
    project_path: String,
    messages: Vec<String>,
) -> Result<(), String> {
    log::info!(
        "Tracking {} messages for session {}",
        messages.len(),
        session_id
    );

    let manager = state
        .get_or_create_manager(
            session_id.clone(),
            project_id.clone(),
            PathBuf::from(&project_path),
        )
        .await
        .map_err(|e| format!("Failed to get checkpoint manager: {}", e))?;

    for message in messages {
        manager
            .track_message(message)
            .await
            .map_err(|e| format!("Failed to track message: {}", e))?;
    }

    Ok(())
}

/// Deletes a specific session from a project and all associated data
#[command]
pub async fn delete_session(project_id: String, session_id: String) -> Result<serde_json::Value, String> {
    log::info!("Deleting session '{}' from project '{}'", session_id, project_id);
    
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    let project_dir = claude_dir.join("projects").join(&project_id);
    let session_file = project_dir.join(format!("{}.jsonl", session_id));
    
    if !session_file.exists() {
        return Err(format!("Session '{}' not found in project '{}'", session_id, project_id));
    }
    
    // Get file size before deletion
    let file_size = fs::metadata(&session_file)
        .map_err(|e| format!("Failed to get session file metadata: {}", e))?
        .len();
    
    // Delete the session file
    fs::remove_file(&session_file)
        .map_err(|e| format!("Failed to delete session file: {}", e))?;
    
    // Clean up associated files
    let todos_dir = claude_dir.join("todos");
    let mut todos_deleted = 0;
    let mut timelines_deleted = 0;
    
    // Delete all agent todo files for this session (pattern: {session-id}-agent-*.json)
    if todos_dir.exists() {
        if let Ok(todo_entries) = fs::read_dir(&todos_dir) {
            for todo_entry in todo_entries.flatten() {
                let file_name = todo_entry.file_name().to_string_lossy().to_string();
                if file_name.starts_with(&format!("{}-agent-", session_id)) && file_name.ends_with(".json") {
                    if let Err(e) = fs::remove_file(todo_entry.path()) {
                        log::warn!("Failed to delete todo file '{}': {}", file_name, e);
                    } else {
                        todos_deleted += 1;
                        log::debug!("Deleted todo file: {}", file_name);
                    }
                }
            }
        }
    }
    
    // Delete timeline directory for this session
    let timeline_dir = project_dir.join(".timelines").join(&session_id);
    if timeline_dir.exists() {
        if let Err(e) = fs::remove_dir_all(&timeline_dir) {
            log::warn!("Failed to delete timeline directory for session '{}': {}", session_id, e);
        } else {
            timelines_deleted = 1;
            log::debug!("Deleted timeline directory for session: {}", session_id);
        }
    }
    
    // Note: Statsig files don't appear to be session-specific based on file structure analysis
    // They seem to be global cache files, so we don't delete them
    
    log::info!("Successfully deleted session '{}' with {} todos, {} timelines ({:.2} KB)", 
               session_id, todos_deleted, timelines_deleted, file_size as f64 / 1024.0);
    
    Ok(serde_json::json!({
        "success": true,
        "session_id": session_id,
        "project_id": project_id,
        "todos_deleted": todos_deleted,
        "timelines_deleted": timelines_deleted,
        "size_kb": file_size as f64 / 1024.0,
        "message": format!("Deleted session {} with {} todos, {} timelines", session_id, todos_deleted, timelines_deleted)
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
            
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
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